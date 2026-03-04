-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create knowledge_embeddings table
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id VARCHAR(255) UNIQUE NOT NULL,
  content TEXT NOT NULL,
  section VARCHAR(100),
  embedding vector(1536) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS knowledge_embeddings_embedding_idx
  ON knowledge_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- Create index on section for filtering
CREATE INDEX IF NOT EXISTS knowledge_embeddings_section_idx
  ON knowledge_embeddings (section);
