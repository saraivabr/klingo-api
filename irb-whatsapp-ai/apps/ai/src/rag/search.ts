import OpenAI from 'openai';
import { redis } from '@irb/database';
import postgres from 'postgres';
import { createHash } from 'crypto';

const embeddingClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://irb:irb_dev_2024@localhost:5432/irb_whatsapp';
const sql = postgres(DATABASE_URL);

export interface KnowledgeChunk {
  chunkId: string;
  content: string;
  section: string;
  score: number;
  metadata: Record<string, unknown> | null;
}

const CACHE_TTL = 3600; // 1 hour
const DEFAULT_TOP_K = 5;
const MIN_SIMILARITY = 0.3;

function cacheKey(query: string): string {
  const hash = createHash('sha256').update(query.toLowerCase().trim()).digest('hex').slice(0, 16);
  return `rag:cache:${hash}`;
}

async function generateQueryEmbedding(query: string): Promise<number[]> {
  const response = await embeddingClient.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  return response.data[0].embedding;
}

export async function searchKnowledge(
  query: string,
  topK: number = DEFAULT_TOP_K,
): Promise<KnowledgeChunk[]> {
  // Check Redis cache
  const cached = await redis.get(cacheKey(query));
  if (cached) {
    return JSON.parse(cached) as KnowledgeChunk[];
  }

  // Generate embedding for the query
  const embedding = await generateQueryEmbedding(query);
  const embeddingStr = `[${embedding.join(',')}]`;

  // Search via pgvector cosine similarity
  const results = await sql`
    SELECT
      chunk_id,
      content,
      section,
      metadata,
      1 - (embedding <=> ${embeddingStr}::vector) AS score
    FROM knowledge_embeddings
    WHERE 1 - (embedding <=> ${embeddingStr}::vector) > ${MIN_SIMILARITY}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${topK}
  `;

  const chunks: KnowledgeChunk[] = results.map(row => ({
    chunkId: row.chunk_id as string,
    content: row.content as string,
    section: row.section as string,
    score: parseFloat(row.score as string),
    metadata: row.metadata as Record<string, unknown> | null,
  }));

  // Cache results
  if (chunks.length > 0) {
    await redis.set(cacheKey(query), JSON.stringify(chunks), 'EX', CACHE_TTL);
  }

  return chunks;
}

export function formatChunksForPrompt(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) return '';

  return chunks
    .map(c => `[${c.section}] ${c.content}`)
    .join('\n\n---\n\n');
}
