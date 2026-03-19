import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CalendarRange, RefreshCw, WalletCards } from 'lucide-react';
import { api } from '../services/api';

interface PaymentOrderItem {
  id: string;
  employeeName: string;
  employeeRole: string | null;
  contractType: string;
  monthlyAmount: number;
  referenceMonth: string;
  workDays: number | null;
  dailyAmount: number | null;
  status: string;
  costCenterName: string | null;
}

function formatCurrency(cents: number) {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatMonth(value: string) {
  const [year, month] = value.split('-');
  return `${month}/${year}`;
}

function badge(status: string) {
  return status === 'paid'
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : 'bg-amber-50 text-amber-700 ring-amber-200';
}

function Surface({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function PaymentOrders() {
  const [rows, setRows] = useState<PaymentOrderItem[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<Array<{ referenceMonth: string; totalAmount: number; employeeCount: number }>>([]);
  const [referenceMonth, setReferenceMonth] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.getPaymentOrders({ limit: '100', ...(referenceMonth ? { referenceMonth } : {}) });
      setRows(response.items);
      setMonthlySummary(response.monthlySummary);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [referenceMonth]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += row.monthlyAmount;
        if (row.status === 'paid') acc.paid += row.monthlyAmount;
        else acc.pending += row.monthlyAmount;
        return acc;
      },
      { total: 0, pending: 0, paid: 0 },
    );
  }, [rows]);

  if (loading) {
    return <div className="px-6 py-6 text-sm text-slate-500">Carregando ordens de pagamento...</div>;
  }

  return (
    <div className="space-y-6 px-6 py-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-900 bg-slate-950 text-white shadow-2xl shadow-slate-950/15">
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.35fr_0.95fr] lg:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">Ordens de Pagamento</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight">Lotes operacionais por competência para execução de VT e verbas recorrentes.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Aqui entra a lógica do protótipo de ordem de pagamento, mas aplicada sobre os lançamentos reais importados para produção.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Valor do Lote</p>
              <p className="mt-2 text-2xl font-semibold">{formatCurrency(totals.total)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Pendente</p>
              <p className="mt-2 text-2xl font-semibold text-amber-300">{formatCurrency(totals.pending)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Pago</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-300">{formatCurrency(totals.paid)}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Surface
          title="Competências"
          subtitle="Concentração mensal das ordens ativas."
          action={
            <button onClick={load} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
              <RefreshCw size={16} />
            </button>
          }
        >
          <div className="space-y-3">
            {monthlySummary.map((summary) => (
              <button
                key={summary.referenceMonth}
                onClick={() => setReferenceMonth(referenceMonth === summary.referenceMonth ? '' : summary.referenceMonth)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  referenceMonth === summary.referenceMonth ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CalendarRange size={18} className="text-slate-500" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{formatMonth(summary.referenceMonth)}</p>
                      <p className="text-xs text-slate-500">{summary.employeeCount} colaboradores</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{formatCurrency(summary.totalAmount)}</p>
                </div>
              </button>
            ))}
          </div>
        </Surface>

        <Surface title="Itens da ordem" subtitle={referenceMonth ? `Competência filtrada em ${formatMonth(referenceMonth)}.` : 'Todos os itens importados das ordens de pagamento.'}>
          {rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              Nenhum item encontrado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                    <th className="pb-3 pr-4 font-medium">Colaborador</th>
                    <th className="pb-3 pr-4 font-medium">Centro</th>
                    <th className="pb-3 pr-4 font-medium">Competência</th>
                    <th className="pb-3 pr-4 font-medium">Status</th>
                    <th className="pb-3 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="py-3 pr-4">
                        <div>
                          <p className="font-medium text-slate-900">{row.employeeName}</p>
                          <p className="text-xs text-slate-500">{row.employeeRole || row.contractType}</p>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-500">{row.costCenterName || 'Sem centro'}</td>
                      <td className="py-3 pr-4 text-slate-500">{formatMonth(row.referenceMonth)}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${badge(row.status)}`}>{row.status}</span>
                      </td>
                      <td className="py-3 text-right font-semibold text-slate-900">{formatCurrency(row.monthlyAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-3">
                <WalletCards size={18} className="text-slate-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{rows.length}</p>
                  <p className="text-xs text-slate-500">Itens no lote</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-3">
                <Building2 size={18} className="text-slate-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{new Set(rows.map((row) => row.costCenterName || 'Sem centro')).size}</p>
                  <p className="text-xs text-slate-500">Centros envolvidos</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-3">
                <CalendarRange size={18} className="text-slate-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">{referenceMonth ? formatMonth(referenceMonth) : 'Todas'}</p>
                  <p className="text-xs text-slate-500">Competência em foco</p>
                </div>
              </div>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
}
