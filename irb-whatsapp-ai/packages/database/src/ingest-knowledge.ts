import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://irb:irb_dev_2024@localhost:5432/irb_whatsapp';
const sql = postgres(DATABASE_URL);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Chunk {
  chunkId: string;
  content: string;
  section: string;
  metadata: { title: string; subsection?: string };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function chunkMarkdown(markdown: string): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = markdown.split('\n');

  let currentSection = '';
  let currentSectionSlug = '';
  let currentSubsection = '';
  let currentContent: string[] = [];
  let chunkCounter: Record<string, number> = {};

  function flushChunk() {
    const text = currentContent.join('\n').trim();
    if (!text || text.length < 20) return;

    const key = currentSectionSlug || 'geral';
    chunkCounter[key] = (chunkCounter[key] || 0) + 1;
    const chunkId = `${key}_${chunkCounter[key]}`;

    chunks.push({
      chunkId,
      content: text,
      section: currentSection || 'Geral',
      metadata: {
        title: currentSection || 'Geral',
        subsection: currentSubsection || undefined,
      },
    });
  }

  for (const line of lines) {
    // New H2 section (## )
    if (line.startsWith('## ')) {
      flushChunk();
      currentContent = [];
      currentSection = line.replace(/^##\s+/, '').replace(/^\d+\.\s*/, '');
      currentSectionSlug = slugify(currentSection);
      currentSubsection = '';
      continue;
    }

    // New H3 subsection (### )
    if (line.startsWith('### ')) {
      flushChunk();
      currentContent = [];
      currentSubsection = line.replace(/^###\s+/, '').replace(/^\d+\.\d+\s*/, '');
      continue;
    }

    // Skip separators and empty front matter
    if (line.trim() === '---' || line.trim() === '') {
      if (currentContent.length > 0 && currentContent[currentContent.length - 1]?.trim() !== '') {
        currentContent.push(line);
      }
      continue;
    }

    // Skip the title line and intro
    if (line.startsWith('# ') || line.startsWith('> Documento extraído')) {
      continue;
    }

    currentContent.push(line);
  }

  // Flush the last chunk
  flushChunk();

  // Post-process: split chunks that are too large (> ~500 tokens ~ 2000 chars)
  const MAX_CHUNK_CHARS = 2000;
  const finalChunks: Chunk[] = [];

  for (const chunk of chunks) {
    if (chunk.content.length <= MAX_CHUNK_CHARS) {
      finalChunks.push(chunk);
    } else {
      // Split by double newline or code blocks
      const parts = chunk.content.split(/\n\n+/);
      let buffer = '';
      let partIdx = 0;

      for (const part of parts) {
        if (buffer.length + part.length > MAX_CHUNK_CHARS && buffer.length > 0) {
          partIdx++;
          finalChunks.push({
            chunkId: `${chunk.chunkId}_p${partIdx}`,
            content: buffer.trim(),
            section: chunk.section,
            metadata: { ...chunk.metadata, subsection: chunk.metadata.subsection },
          });
          buffer = '';
        }
        buffer += (buffer ? '\n\n' : '') + part;
      }

      if (buffer.trim()) {
        partIdx++;
        finalChunks.push({
          chunkId: partIdx > 1 ? `${chunk.chunkId}_p${partIdx}` : chunk.chunkId,
          content: buffer.trim(),
          section: chunk.section,
          metadata: chunk.metadata,
        });
      }
    }
  }

  return finalChunks;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });
  return response.data.map(d => d.embedding);
}

async function main() {
  console.log('Starting knowledge base ingestion...');

  // Enable pgvector extension
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log('pgvector extension enabled');

  // Ensure table exists
  await sql`
    CREATE TABLE IF NOT EXISTS knowledge_embeddings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chunk_id VARCHAR(255) UNIQUE NOT NULL,
      content TEXT NOT NULL,
      section VARCHAR(100),
      embedding vector(1536) NOT NULL,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Create HNSW index if not exists
  await sql`
    CREATE INDEX IF NOT EXISTS knowledge_embeddings_embedding_idx
      ON knowledge_embeddings
      USING hnsw (embedding vector_cosine_ops)
  `;

  // Read and chunk the knowledge base
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const kbPath = resolve(__dirname, '../../../knowledge-base-rag.md');
  console.log(`Reading knowledge base from: ${kbPath}`);
  const markdown = readFileSync(kbPath, 'utf-8');
  const chunks = chunkMarkdown(markdown);
  console.log(`Created ${chunks.length} chunks`);

  // Generate embeddings in batches of 20
  const BATCH_SIZE = 20;
  let processed = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.content);
    const embeddings = await generateEmbeddingsBatch(texts);

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j];
      const embedding = embeddings[j];
      const embeddingStr = `[${embedding.join(',')}]`;

      await sql`
        INSERT INTO knowledge_embeddings (chunk_id, content, section, embedding, metadata)
        VALUES (${chunk.chunkId}, ${chunk.content}, ${chunk.section}, ${embeddingStr}::vector, ${JSON.stringify(chunk.metadata)})
        ON CONFLICT (chunk_id) DO UPDATE SET
          content = EXCLUDED.content,
          section = EXCLUDED.section,
          embedding = EXCLUDED.embedding,
          metadata = EXCLUDED.metadata,
          created_at = NOW()
      `;
      processed++;
    }

    console.log(`Processed ${processed}/${chunks.length} chunks`);
  }

  // Clean up old chunks that no longer exist
  const currentChunkIds = chunks.map(c => c.chunkId);
  await sql`
    DELETE FROM knowledge_embeddings
    WHERE chunk_id != ALL(${currentChunkIds})
  `;

  console.log(`Ingestion complete! ${processed} chunks stored.`);
  await sql.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
