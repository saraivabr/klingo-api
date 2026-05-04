import React, { useEffect, useState } from 'react';
import { DollarSign, Users, AlertCircle, TrendingDown, CalendarPlus, UserX, PieChart } from 'lucide-react';
import { api } from '../services/api';

interface PlanRevenue {
  planId: string;
  planName: string;
  activeCount: number;
  mrrCents: number;
}

interface IndicatorsData {
  period: { monthStart: string; now: string };
  revenue: { mtdCents: number; mtdPaymentsCount: number };
  subscriptions: {
    active: number;
    overdue: number;
    cancelledThisMonth: number;
    activeAtMonthStart: number;
    churnRatePct: number;
  };
  appointments: {
    newToday: number;
    noShowLast30: number;
    realizedLast30: number;
    noShowRatePct: number;
  };
  revenueByPlan: PlanRevenue[];
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Indicators() {
  const [data, setData] = useState<IndicatorsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getIndicators().then(setData).finally(() => setLoading(false));
  }, []);

  const Card = ({ icon: Icon, label, value, sub, color }: {
    icon: any; label: string; value: string | number; sub?: string; color: string;
  }) => (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${color}`}><Icon size={18} /></div>
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );

  if (loading) {
    return <div className="px-6 py-6"><p className="text-slate-400">Carregando indicadores...</p></div>;
  }

  if (!data) {
    return <div className="px-6 py-6"><p className="text-red-500">Falha ao carregar indicadores</p></div>;
  }

  const totalMrr = data.revenueByPlan.reduce((acc, p) => acc + p.mrrCents, 0);

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Indicadores Internos</h2>
        <p className="text-sm text-slate-500">Mês de referência: {new Date(data.period.monthStart).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
      </div>

      <section>
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Receita</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card icon={DollarSign} label="Faturamento MTD" value={formatBRL(data.revenue.mtdCents)} sub={`${data.revenue.mtdPaymentsCount} pagamentos`} color="bg-green-50 text-green-600" />
          <Card icon={TrendingDown} label="MRR (ativas)" value={formatBRL(totalMrr)} color="bg-emerald-50 text-emerald-600" />
          <Card icon={Users} label="Assinaturas Ativas" value={data.subscriptions.active} color="bg-blue-50 text-blue-600" />
          <Card icon={AlertCircle} label="Em Atraso" value={data.subscriptions.overdue} color="bg-orange-50 text-orange-600" />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Churn & Agendamentos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card icon={TrendingDown} label="Churn do Mês" value={`${data.subscriptions.churnRatePct}%`} sub={`${data.subscriptions.cancelledThisMonth} canceladas / ${data.subscriptions.activeAtMonthStart} base`} color="bg-red-50 text-red-600" />
          <Card icon={CalendarPlus} label="Agendamentos Hoje" value={data.appointments.newToday} color="bg-indigo-50 text-indigo-600" />
          <Card icon={UserX} label="Taxa de No-Show (30d)" value={`${data.appointments.noShowRatePct}%`} sub={`${data.appointments.noShowLast30} / ${data.appointments.realizedLast30}`} color="bg-amber-50 text-amber-600" />
          <Card icon={PieChart} label="Planos Ativos" value={data.revenueByPlan.length} color="bg-purple-50 text-purple-600" />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Receita por Plano</h3>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Plano</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Ativas</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">MRR</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">% do MRR</th>
              </tr>
            </thead>
            <tbody>
              {data.revenueByPlan.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Nenhuma assinatura ativa</td></tr>
              )}
              {data.revenueByPlan.map(plan => (
                <tr key={plan.planId} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-sm text-slate-900">{plan.planName}</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-600">{plan.activeCount}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-slate-900">{formatBRL(plan.mrrCents)}</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-500">
                    {totalMrr > 0 ? `${((plan.mrrCents / totalMrr) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
