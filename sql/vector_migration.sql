-- Enable pgvector extension
create extension if not exists vector;

-- Add embedding column to meetings table (1536 dimensions for OpenAI text-embedding-3-small)
alter table public.meetings add column if not exists embedding vector(1536);

-- Create an HNSW index for fast approximate nearest neighbor search
create index if not exists meetings_embedding_idx on public.meetings using hnsw (embedding vector_cosine_ops);

-- Create RPC function to match meetings semantically
create or replace function public.match_meetings(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
returns table (
  id uuid,
  similarity float
)
language sql stable
as $$
  select
    meetings.id,
    1 - (meetings.embedding <=> query_embedding) as similarity
  from public.meetings
  where 1 - (meetings.embedding <=> query_embedding) > match_threshold
    and meetings.user_id = p_user_id
  order by meetings.embedding <=> query_embedding
  limit match_count;
$$;
