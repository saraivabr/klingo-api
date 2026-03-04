import React, { useEffect, useState } from 'react';
import { Users, DollarSign, AlertTriangle, TrendingDown } from 'lucide-react';
import { api } from '../services/api';

interface FinanceSummary {
  activeSubscriptions: number;
  overdueSubscriptions: number;
  monthRevenueCents: number;
  overdueTotalCents: number;
}

interface Payment {
  id: string;
  status: string;
  billingType: string;
  amountCents: number;
  dueDate: string | null;
  paidAt: string | null;
  invoiceUrl: string | null;
  patientName: string | null;
  planName: string;
}

const PAYMENT_STATUS_BADGES: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-700' },
  CONFIRMED: { label: 'Confirmado', className: 'bg-emerald-100 text-emerald-700' },
  RECEIVED: { label: 'Recebido', className: 'bg-emerald-100 text-emerald-700' },
  OVERDUE: { label: 'Vencido', className: 'bg-red-100 text-red-700' },
  REFUNDED: { label: 'Reembolsado', className: 'bg-slate-100 text-slate-500' },
};

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

export default function Finance() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getFinanceSummary(),
      api.getPayments({ limit: '20' }),
    ]).then(([sum, pay]) => {
      setSummary(sum);
      setPayments(pay.payments);
    }).finally(() => setLoading(false));
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
      <h2 className="text-xl font-bold text-slate-900 mb-6">Financeiro</h2>

      {loading ? <p className="text-slate-400">Carregando...</p> : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={Users} label="Assinantes Ativos" value={summary?.activeSubscriptions || 0} color="bg-blue-50 text-blue-600" />
            <StatCard icon={DollarSign} label="Receita do Mês" value={formatCurrency(summary?.monthRevenueCents || 0)} color="bg-emerald-50 text-emerald-600" />
            <StatCard icon={AlertTriangle} label="Inadimplentes" value={summary?.overdueSubscriptions || 0} color="bg-orange-50 text-orange-600" />
            <StatCard icon={TrendingDown} label="Total em Atraso" value={formatCurrency(summary?.overdueTotalCents || 0)} color="bg-red-50 text-red-600" />
          </div>

          {/* Recent Payments */}
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Pagamentos Recentes</h3>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Paciente</th>
                  <th className="text-left px-4 py-3 font-medium">Plano</th>
                  <th className="text-left px-4 py-3 font-medium">Valor</th>
                  <th className="text-left px-4 py-3 font-medium">Vencimento</th>
                  <th className="text-left px-4 py-3 font-medium">Pago em</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map(p => {
                  const badge = PAYMENT_STATUS_BADGES[p.status] || { label: p.status, className: 'bg-slate-100 text-slate-500' };
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{p.patientName || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{p.planName}</td>
                      <td className="px-4 py-3 text-slate-600">{formatCurrency(p.amountCents)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(p.dueDate)}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(p.paidAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>{badge.label}</span>
                      </td>
                    </tr>
                  );
                })}
                {payments.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Nenhum pagamento registrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
