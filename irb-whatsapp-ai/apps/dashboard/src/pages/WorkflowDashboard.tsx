import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity, AlertCircle, CheckCircle, Clock, TrendingUp, Users, FileText,
  Pill, FlaskConical, CreditCard, Package, RefreshCw, ArrowRight, Loader2,
} from 'lucide-react';
import { api } from '../services/api';

/* ── Types ─────────────────────────────────────── */

interface WorkflowStats {
  date: string;
  opd: {
    byStatus: Record<string, number>;
    total: number;
    recent: Array<{
      id: string;
      patientName: string | null;
      patientPhone: string;
      doctorName: string | null;
      status: string;
      visitDate: string;
      symptoms: string | null;
    }>;
  };
  lab: {
    byStatus: Record<string, number>;
    total: number;
    recent: Array<{
      id: string;
      orderNumber: string;
      status: string;
      priority: string;
      orderedAt: string;
      patientId: string;
    }>;
  };
  billing: {
    byStatus: Record<string, number>;
    total: number;
    recent: Array<{
      id: string;
      billNumber: string;
      status: string;
      netAmount: number;
      createdAt: string;
      patientId: string;
    }>;
  };
  pharmacy: {
    pendingPrescriptions: number;
    lowStockCount: number;
    lowStockMedicines: Array<{
      id: string;
      name: string;
      quantity: number;
      alertQuantity: number;
    }>;
  };
}

/* ── Helpers ───────────────────────────────────── */

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

const STATUS_COLORS = {
  // OPD
  waiting: { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100', dot: 'bg-amber-500' },
  'in-progress': { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100', dot: 'bg-blue-500' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100', dot: 'bg-emerald-500' },
  // Lab
  ordered: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100', dot: 'bg-blue-500' },
  collected: { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100', dot: 'bg-amber-500' },
  processing: { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100', dot: 'bg-purple-500' },
  // Billing
  pending: { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100', dot: 'bg-orange-500' },
  partial: { bg: 'bg-yellow-50', text: 'text-yellow-700', badge: 'bg-yellow-100', dot: 'bg-yellow-500' },
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100', dot: 'bg-emerald-500' },
  cancelled: { bg: 'bg-slate-50', text: 'text-slate-700', badge: 'bg-slate-100', dot: 'bg-slate-400' },
};

const getStatusColor = (status: string) => STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending;

/* ── Stats Card ────────────────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
        {Icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-600 font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
      </div>
    </div>
  );
}

/* ── Status Indicator ──────────────────────────── */

function StatusIndicator({ status }: { status: string }) {
  const colors = getStatusColor(status);
  const labels: Record<string, string> = {
    waiting: 'Aguardando',
    'in-progress': 'Em Atendimento',
    completed: 'Concluído',
    ordered: 'Solicitado',
    collected: 'Coletado',
    processing: 'Processando',
    pending: 'Pendente',
    partial: 'Parcial',
    paid: 'Pago',
    cancelled: 'Cancelado',
  };

  return (
    <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold ${colors.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {labels[status] || status}
    </span>
  );
}

/* ── Activity List ─────────────────────────────── */

function ActivityItem({
  type,
  icon: Icon,
  title,
  description,
  timestamp,
  status,
}: {
  type: 'opd' | 'lab' | 'billing' | 'pharmacy';
  icon: React.ReactNode;
  title: string;
  description?: string;
  timestamp: string;
  status: string;
}) {
  const typeColors = {
    opd: 'bg-blue-50 text-blue-600',
    lab: 'bg-purple-50 text-purple-600',
    billing: 'bg-green-50 text-green-600',
    pharmacy: 'bg-pink-50 text-pink-600',
  };

  return (
    <div className="bg-white rounded-lg border border-slate-100 p-4 hover:border-slate-200 transition-colors">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg ${typeColors[type]} flex items-center justify-center flex-shrink-0`}>
          {Icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-slate-900 text-sm truncate">{title}</h4>
            <StatusIndicator status={status} />
          </div>
          {description && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{description}</p>}
          <p className="text-xs text-slate-500 mt-2">{formatTime(timestamp)}</p>
        </div>
        <ArrowRight size={16} className="text-slate-400 flex-shrink-0" />
      </div>
    </div>
  );
}

/* ── Main Component ────────────────────────────── */

export default function WorkflowDashboard() {
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const data = await api.getWorkflowStats();
      setStats(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to load workflow stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Auto-refresh a cada 30 segundos
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadStats]);

  if (loading || !stats) {
    return (
      <div className="px-8 py-7 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      </div>
    );
  }

  const totalActive = stats.opd.byStatus['waiting'] + stats.opd.byStatus['in-progress'] +
    stats.lab.byStatus['ordered'] + stats.lab.byStatus['collected'] + stats.lab.byStatus['processing'] +
    stats.billing.byStatus['pending'] + stats.billing.byStatus['partial'];

  return (
    <div className="px-8 py-7 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Painel de Jornadas em Tempo Real</h2>
          <p className="text-slate-500 text-sm mt-0.5">Acompanhamento de todas as operações clínicas e administrativas</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadStats}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="Atualizar agora"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              autoRefresh
                ? 'bg-blue-100 text-blue-700'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {autoRefresh ? 'Auto' : 'Manual'}
          </button>
        </div>
      </div>

      {/* Last Update */}
      <div className="mb-6 text-xs text-slate-500">
        Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          icon={<Activity size={24} className="text-blue-600" />}
          label="Processos Ativos"
          value={totalActive}
          color="bg-blue-50"
        />
        <StatCard
          icon={<Users size={24} className="text-cyan-600" />}
          label="Consultas Hoje"
          value={stats.opd.total}
          subtext={`${stats.opd.byStatus['completed'] || 0} concluídas`}
          color="bg-cyan-50"
        />
        <StatCard
          icon={<FlaskConical size={24} className="text-purple-600" />}
          label="Exames"
          value={stats.lab.total}
          subtext={`${stats.lab.byStatus['completed'] || 0} prontos`}
          color="bg-purple-50"
        />
        <StatCard
          icon={<CreditCard size={24} className="text-emerald-600" />}
          label="Faturas"
          value={stats.billing.total}
          subtext={`${stats.billing.byStatus['paid'] || 0} pagas`}
          color="bg-emerald-50"
        />
        <StatCard
          icon={<Pill size={24} className="text-pink-600" />}
          label="Farmácia"
          value={stats.pharmacy.lowStockCount}
          subtext="itens com estoque baixo"
          color="bg-pink-50"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* OPD Section */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Consultas (OPD)</h3>
              <Users size={20} className="text-blue-600" />
            </div>

            {/* Status breakdown */}
            <div className="space-y-3 mb-6">
              {[
                { key: 'waiting', label: 'Aguardando', icon: Clock },
                { key: 'in-progress', label: 'Em Atendimento', icon: AlertCircle },
                { key: 'completed', label: 'Concluído', icon: CheckCircle },
              ].map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={`${getStatusColor(key).text}`} />
                    <span className="text-sm text-slate-600">{label}</span>
                  </div>
                  <span className="font-bold text-slate-900">{stats.opd.byStatus[key] || 0}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <h4 className="text-xs font-semibold text-slate-600 uppercase mb-3">Atividade Recente</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {stats.opd.recent.length > 0 ? (
                  stats.opd.recent.slice(0, 5).map(visit => (
                    <ActivityItem
                      key={visit.id}
                      type="opd"
                      icon={<Users size={16} />}
                      title={visit.patientName || 'Paciente'}
                      description={`Dr. ${visit.doctorName || 'N/A'}`}
                      timestamp={visit.visitDate}
                      status={visit.status}
                    />
                  ))
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">Nenhuma atividade</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Lab Section */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Laboratório</h3>
              <FlaskConical size={20} className="text-purple-600" />
            </div>

            {/* Status breakdown */}
            <div className="space-y-3 mb-6">
              {[
                { key: 'ordered', label: 'Solicitados' },
                { key: 'collected', label: 'Coletados' },
                { key: 'processing', label: 'Processando' },
                { key: 'completed', label: 'Concluído' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{label}</span>
                  <span className="font-bold text-slate-900">{stats.lab.byStatus[key] || 0}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <h4 className="text-xs font-semibold text-slate-600 uppercase mb-3">Pedidos Recentes</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {stats.lab.recent.length > 0 ? (
                  stats.lab.recent.slice(0, 5).map(order => (
                    <ActivityItem
                      key={order.id}
                      type="lab"
                      icon={<FlaskConical size={16} />}
                      title={order.orderNumber}
                      description={order.priority === 'urgent' ? '🚨 URGENTE' : 'Normal'}
                      timestamp={order.orderedAt}
                      status={order.status}
                    />
                  ))
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">Nenhuma atividade</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Billing & Pharmacy Section */}
        <div className="lg:col-span-1 space-y-8">
          {/* Billing */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Faturamento</h3>
              <CreditCard size={20} className="text-emerald-600" />
            </div>

            <div className="space-y-3 mb-6">
              {[
                { key: 'pending', label: 'Pendente' },
                { key: 'partial', label: 'Parcial' },
                { key: 'paid', label: 'Pago' },
                { key: 'cancelled', label: 'Cancelado' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{label}</span>
                  <span className="font-bold text-slate-900">{stats.billing.byStatus[key] || 0}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <h4 className="text-xs font-semibold text-slate-600 uppercase mb-3">Movimentações</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {stats.billing.recent.length > 0 ? (
                  stats.billing.recent.slice(0, 4).map(bill => (
                    <ActivityItem
                      key={bill.id}
                      type="billing"
                      icon={<CreditCard size={16} />}
                      title={bill.billNumber}
                      description={formatCurrency(bill.netAmount)}
                      timestamp={bill.createdAt}
                      status={bill.status}
                    />
                  ))
                ) : (
                  <p className="text-xs text-slate-500 text-center py-4">Nenhuma atividade</p>
                )}
              </div>
            </div>
          </div>

          {/* Pharmacy Alerts */}
          {stats.pharmacy.lowStockCount > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-red-900 mb-3">⚠️ Medicamentos com Estoque Baixo</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {stats.pharmacy.lowStockMedicines.map(med => (
                      <div key={med.id} className="bg-white rounded-lg p-2 text-xs">
                        <p className="font-medium text-slate-900">{med.name}</p>
                        <p className="text-slate-600">
                          Estoque: {med.quantity} (mín: {med.alertQuantity})
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
