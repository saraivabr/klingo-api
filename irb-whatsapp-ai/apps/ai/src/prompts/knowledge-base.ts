import { db, schema } from '@irb/database';

export async function loadKnowledgeBase(): Promise<Record<string, string>> {
  const entries = await db.select().from(schema.knowledgeBase);
  const kb: Record<string, string> = {};
  for (const entry of entries) {
    kb[entry.key] = entry.answer;
  }
  return kb;
}
