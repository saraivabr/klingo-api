import React, { useEffect, useState } from 'react';
import { MessageSquare, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

export default function Metrics() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMetrics().then(setMetrics).finally(() => setLoading(false));
  }, []);

  const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) => (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${color}`}><Icon size={20} /></div>
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );

  return (
    <div className="px-6 py-6">
      <h2 className="text-xl font-bold text-slate-900 mb-6">Métricas de Hoje</h2>
      {loading ? <p className="text-slate-400">Carregando...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={MessageSquare} label="Conversas Ativas" value={metrics?.activeConversations || 0} color="bg-blue-50 text-blue-600" />
          <StatCard icon={AlertTriangle} label="Escalações Pendentes" value={metrics?.escalationsPending || 0} color="bg-orange-50 text-orange-600" />
          <StatCard icon={TrendingUp} label="Mensagens Hoje" value={metrics?.today?.totalMessages || 0} color="bg-green-50 text-green-600" />
          <StatCard icon={Clock} label="Tempo Médio Resposta" value={metrics?.today?.avgResponseTimeMs ? `${(metrics.today.avgResponseTimeMs / 1000).toFixed(1)}s` : 'N/A'} color="bg-purple-50 text-purple-600" />
        </div>
      )}
    </div>
  );
}
