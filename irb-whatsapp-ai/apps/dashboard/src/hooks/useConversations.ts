import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { useWebSocket } from './useWebSocket';
import type { Conversation, PipelineColumns } from '../types/conversation';

const STATE_TO_STAGE: Record<string, keyof PipelineColumns> = {
  greeting: 'greeting',
  exploring: 'understanding',
  service_inquiry: 'understanding',
  price_discussion: 'understanding',
  scheduling: 'scheduling',
  collecting_info: 'scheduling',
  confirmation: 'confirming',
  post_booking: 'done',
  follow_up: 'done',
};

function getStage(c: Conversation): keyof PipelineColumns {
  if (c.status === 'closed') return 'closed';
  if (c.status === 'escalated' || !c.isAiHandling) return 'escalated';
  return STATE_TO_STAGE[c.state] || 'greeting';
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [closedConversations, setClosedConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { lastMessage } = useWebSocket();

  const fetchAll = useCallback(async () => {
    try {
      const [active, closed] = await Promise.all([
        api.getConversations(),
        api.getConversations({ status: 'closed' }),
      ]);
      setConversations(active.conversations);
      setClosedConversations(closed.conversations.slice(0, 20));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (lastMessage?.channel === 'channel:conversations') {
      fetchAll();
    }
  }, [lastMessage, fetchAll]);

  const pipeline: PipelineColumns = useMemo(() => {
    const cols: PipelineColumns = {
      greeting: [],
      understanding: [],
      scheduling: [],
      confirming: [],
      done: [],
      escalated: [],
      closed: closedConversations,
    };

    for (const c of conversations) {
      const stage = getStage(c);
      if (stage !== 'closed') cols[stage].push(c);
    }

    return cols;
  }, [conversations, closedConversations]);

  return { pipeline, loading, refetch: fetchAll };
}
