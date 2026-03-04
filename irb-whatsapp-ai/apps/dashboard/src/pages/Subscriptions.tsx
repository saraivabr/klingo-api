import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Search, CreditCard, QrCode, FileText,
  Loader2, ChevronRight, TrendingUp, Users, AlertTriangle,
} from 'lucide-react';
import { api } from '../services/api';
import NewSubscriptionWizard from '../components/subscriptions/NewSubscriptionWizard';
import SubscriptionDetailModal from '../components/subscriptions/SubscriptionDetailModal';

/* ── types ─────────────────────────────────────── */

interface Subscription {
  id: string;
  status: string;
  billingType: string;
  nextDueDate: string | null;
  startedAt: string;
  patientName: string | null;
  patientPhone: string;
  planName: string;
  planPriceCents: number;
}

/* ── helpers ───────────────────────────────────── */

const STATUS_CONFIG: Record<string, { label: string; bg: string; dot: string; border: string }> = {
  active:    { label: 'Ativa',        bg: 'bg-emerald-50 text-emerald-700',   dot: 'bg-emerald-500', border: 'border-l-emerald-500' },
  pending:   { label: 'Pendente',     bg: 'bg-amber-50 text-amber-700',       dot: 'bg-amber-500',   border: 'border-l-amber-500' },
  overdue:   { label: 'Inadimplente', bg: 'bg-rose-50 text-rose-700',         dot: 'bg-rose-500',    border: 'border-l-rose-500' },
  suspended: { label: 'Suspensa',     bg: 'bg-orange-50 text-orange-700',     dot: 'bg-orange-500',  border: 'border-l-orange-500' },
  cancelled: { label: 'Cancelada',    bg: 'bg-slate-100 text-slate-500',      dot: 'bg-slate-400',   border: 'border-l-slate-300' },
};

function fmt(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}

/* ── component ─────────────────────────────────── */

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  const loadSubscriptions = useCallback(() => {
    setLoading(true);
    api.getSubscriptions({ status: filter, search })
      .then(data => setSubscriptions(data.subscriptions))
      .finally(() => setLoading(false));
  }, [filter, search]);

  useEffect(() => { loadSubscriptions(); }, [loadSubscriptions]);

  const filters = [
    { key: 'all', label: 'Todas', count: subscriptions.length },
    { key: 'active', label: 'Ativas', dot: 'bg-emerald-500' },
    { key: 'overdue', label: 'Inadimplentes', dot: 'bg-rose-500' },
    { key: 'cancelled', label: 'Canceladas', dot: 'bg-slate-400' },
  ];

  // Quick stats
  const activeCount = subscriptions.filter(s => s.status === 'active').length;
  const overdueCount = subscriptions.filter(s => s.status === 'overdue').length;
  const mrrCents = subscriptions.filter(s => s.status === 'active').reduce((sum, s) => sum + s.planPriceCents, 0);

  return (
    <div className="px-8 py-7 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Assinaturas</h2>
          <p className="text-slate-500 text-sm mt-0.5">Gerencie planos e cobranças dos pacientes</p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="group flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white pl-4 pr-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-emerald-200/50 hover:shadow-emerald-300/60 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
            <Plus size={14} strokeWidth={3} />
          </div>
          Nova Assinatura
        </button>
      </div>

      {/* Quick Stats */}
      {!loading && subscriptions.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-7 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Users size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">{activeCount}</p>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Ativas</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
              <TrendingUp size={18} className="text-teal-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">{fmt(mrrCents)}</p>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">MRR</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${overdueCount > 0 ? 'bg-rose-50' : 'bg-slate-50'}`}>
              <AlertTriangle size={18} className={overdueCount > 0 ? 'text-rose-500' : 'text-slate-400'} />
            </div>
            <div>
              <p className={`text-2xl font-bold tabular-nums tracking-tight ${overdueCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>{overdueCount}</p>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Inadimplentes</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar paciente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
          />
        </div>
        <div className="flex bg-slate-100/80 rounded-xl p-1 gap-0.5">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                filter === f.key
                  ? 'bg-white text-slate-900 shadow-sm shadow-slate-200/60'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f.dot && <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-emerald-500 animate-spin" />
          </div>
          <p className="text-sm text-slate-400 mt-4">Carregando assinaturas...</p>
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="text-center py-24 animate-fade-in">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 flex items-center justify-center mx-auto mb-5 shadow-sm">
            <CreditCard size={32} className="text-slate-300" />
          </div>
          <p className="text-slate-600 font-semibold text-base">Nenhuma assinatura encontrada</p>
          <p className="text-slate-400 text-sm mt-1.5 max-w-xs mx-auto">Crie a primeira assinatura clicando no botão acima</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left pl-6 pr-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-[3px]"></th>
                <th className="text-left px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Paciente</th>
                <th className="text-left px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Plano</th>
                <th className="text-left px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Valor</th>
                <th className="text-left px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Cobrança</th>
                <th className="text-left px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
                <th className="text-left px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Vencimento</th>
                <th className="w-10 pr-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {subscriptions.map((sub, i) => {
                const st = STATUS_CONFIG[sub.status] || STATUS_CONFIG.cancelled;
                return (
                  <tr
                    key={sub.id}
                    onClick={() => setSelectedSubId(sub.id)}
                    className={`table-row-animated group hover:bg-slate-50/80 transition-colors duration-150 cursor-pointer border-l-[3px] ${st.border}`}
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <td className="pl-5 pr-2 py-3.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                        <span className="text-[11px] font-bold text-slate-500">{(sub.patientName || '?')[0].toUpperCase()}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">{sub.patientName || '—'}</span>
                      <span className="block text-[11px] text-slate-400 mt-0.5 tabular-nums">{sub.patientPhone}</span>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-700 text-[13px]">{sub.planName}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-slate-800 tabular-nums">{fmt(sub.planPriceCents)}</span>
                      <span className="text-slate-400 font-normal text-[11px]">/mês</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-slate-500 text-[13px]">
                        {sub.billingType === 'PIX' && <QrCode size={13} className="text-slate-400" />}
                        {sub.billingType === 'BOLETO' && <FileText size={13} className="text-slate-400" />}
                        {sub.billingType === 'CREDIT_CARD' && <CreditCard size={13} className="text-slate-400" />}
                        {sub.billingType === 'CREDIT_CARD' ? 'Cartão' : sub.billingType}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${st.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot} ${sub.status === 'active' ? 'animate-pulse' : ''}`} />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 tabular-nums text-[13px]">{fmtDate(sub.nextDueDate)}</td>
                    <td className="pr-4 py-3.5">
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showWizard && (
        <NewSubscriptionWizard
          onClose={() => setShowWizard(false)}
          onCreated={loadSubscriptions}
        />
      )}

      {selectedSubId && (
        <SubscriptionDetailModal
          subscriptionId={selectedSubId}
          onClose={() => setSelectedSubId(null)}
          onUpdated={loadSubscriptions}
        />
      )}
    </div>
  );
}
