import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useWebSocket } from './useWebSocket';
import type { DashboardMetrics } from '../types/conversation';

const POLL_INTERVAL = 30000;

export function useMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    activeConversations: 0,
    escalationsPending: 0,
    todayMessages: 0,
    avgResponseTime: 'N/A',
  });
  const [loading, setLoading] = useState(true);
  const { lastMessage } = useWebSocket();

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await api.getMetrics();
      setMetrics({
        activeConversations: data.activeConversations || 0,
        escalationsPending: data.escalationsPending || 0,
        todayMessages: data.today?.totalMessages || 0,
        avgResponseTime: data.today?.avgResponseTimeMs
          ? `${(data.today.avgResponseTimeMs / 1000).toFixed(1)}s`
          : 'N/A',
      });
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  useEffect(() => {
    if (lastMessage?.channel === 'channel:conversations' || lastMessage?.channel === 'channel:metrics') {
      fetchMetrics();
    }
  }, [lastMessage, fetchMetrics]);

  return { metrics, loading };
}
