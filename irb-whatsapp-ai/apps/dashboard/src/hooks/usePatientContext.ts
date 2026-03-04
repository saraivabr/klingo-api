import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { PatientContext } from '../types/patient-context';

export function usePatientContext(conversationId: string | null) {
  const [context, setContext] = useState<PatientContext | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const data = await api.getPatientContext(conversationId);
      setContext(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { context, loading, refetch: fetch };
}
