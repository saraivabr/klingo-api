import React from 'react';
import { MessageSquare, AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import MetricCard from '../shared/MetricCard';
import { useMetrics } from '../../hooks/useMetrics';

export default function TopBar() {
  const { metrics, loading } = useMetrics();

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-4 px-6 py-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl px-4 py-3 shadow-sm h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-6 py-4">
      <MetricCard icon={MessageSquare} label="Conversas Ativas" value={metrics.activeConversations} color="bg-blue-50 text-blue-600" />
      <MetricCard icon={AlertTriangle} label="Escalações Pendentes" value={metrics.escalationsPending} color="bg-amber-50 text-amber-600" />
      <MetricCard icon={TrendingUp} label="Mensagens Hoje" value={metrics.todayMessages} color="bg-emerald-50 text-emerald-600" />
      <MetricCard icon={Clock} label="Tempo Médio" value={metrics.avgResponseTime} color="bg-violet-50 text-violet-600" />
    </div>
  );
}
