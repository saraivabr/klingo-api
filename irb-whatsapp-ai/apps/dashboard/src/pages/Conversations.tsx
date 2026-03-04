import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare, AlertTriangle, Clock, LogOut } from 'lucide-react';
import { api } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';

export default function Conversations() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const { connected, lastMessage } = useWebSocket();
  const navigate = useNavigate();

  const loadConversations = async () => {
    try {
      const params: any = {};
      if (filter !== 'all') params.status = filter;
      const data = await api.getConversations(params);
      setConversations(data.conversations);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadConversations(); }, [filter]);
  useEffect(() => {
    if (lastMessage?.channel === 'channel:conversations') loadConversations();
  }, [lastMessage]);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = { active: 'bg-green-100 text-green-700', escalated: 'bg-orange-100 text-orange-700', closed: 'bg-gray-100 text-gray-500' };
    const labels: Record<string, string> = { active: 'IA', escalated: 'Escalado', closed: 'Fechado' };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.closed}`}>{labels[status] || status}</span>;
  };

  const logout = () => { localStorage.removeItem('token'); navigate('/login'); window.location.reload(); };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-irb-dark">IRB Prime Care</h1>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} title={connected ? 'Conectado' : 'Desconectado'} />
          </div>
          <nav className="flex items-center gap-4">
            <Link to="/conversations" className="text-primary-600 font-medium text-sm">Conversas</Link>
            <Link to="/metrics" className="text-gray-500 hover:text-gray-700 text-sm">Métricas</Link>
            <Link to="/settings" className="text-gray-500 hover:text-gray-700 text-sm">Config</Link>
            <button onClick={logout} className="text-gray-400 hover:text-gray-600"><LogOut size={18} /></button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-4">
          {['all', 'active', 'escalated', 'closed'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filter === f ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
              {f === 'all' ? 'Todas' : f === 'active' ? 'IA Ativas' : f === 'escalated' ? 'Escaladas' : 'Fechadas'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Carregando...</div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Nenhuma conversa encontrada</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm divide-y">
            {conversations.map(c => (
              <Link key={c._id} to={`/conversations/${c._id}`} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition">
                <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-medium text-sm">
                  {(c.patientName || c.patientPhone || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">{c.patientName || c.patientPhone}</span>
                    {statusBadge(c.status)}
                  </div>
                  <p className="text-sm text-gray-500 truncate">{c.state} — {c.metrics?.totalMessages || 0} msgs</p>
                </div>
                <div className="text-xs text-gray-400">
                  {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
