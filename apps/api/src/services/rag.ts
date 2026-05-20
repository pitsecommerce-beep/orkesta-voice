import Anthropic from '@anthropic-ai/sdk';
import { getServiceClient } from '../utils/supabase';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function getEmbedding(text: string): Promise<number[]> {
  // Use Voyage embeddings via Anthropic-compatible endpoint or fall back to a simpler approach
  // For MVP we use Claude to generate a summary that feeds into keyword search
  // In production, swap for a proper embedding model (e.g., text-embedding-3-small)
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: text,
      model: 'text-embedding-3-small',
      dimensions: 1536,
    }),
  });

  if (!response.ok) {
    // Gracefully degrade — return empty context if embeddings not available
    return [];
  }

  const data = (await response.json()) as { data: Array<{ embedding: number[] }> };
  return data.data[0]?.embedding ?? [];
}

export async function searchKnowledge(
  query: string,
  orgId: string,
  threshold = 0.7,
  limit = 5
): Promise<string> {
  const embedding = await getEmbedding(query);
  if (embedding.length === 0) return '';

  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc('match_knowledge', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: limit,
    org_id: orgId,
  });

  if (error || !data?.length) return '';

  return data
    .map((item: { content: string; similarity: number }) =>
      `[Relevancia: ${(item.similarity * 100).toFixed(0)}%] ${item.content}`
    )
    .join('\n\n');
}

export async function indexContent(
  content: string,
  orgId: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const embedding = await getEmbedding(content);
  if (embedding.length === 0) return;

  const supabase = getServiceClient();
  await supabase.from('knowledge_embeddings').insert({
    organization_id: orgId,
    content,
    metadata,
    embedding,
  });
}
