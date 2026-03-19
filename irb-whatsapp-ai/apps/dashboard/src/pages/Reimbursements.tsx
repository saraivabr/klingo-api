import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, FileText, RefreshCw, Search, UserCircle2 } from 'lucide-react';
import { api } from '../services/api';

interface ReimbursementItem {
  id: string;
  expenseDate: string;
  expenseType: string;
  description: string | null;
  amount: number;
  approved: boolean | null;
  approvedAmount: number | null;
}

interface ReimbursementRow {
  id: string;
  requestNumber: string;
  employeeName: string;
  employeeDepartment: string | null;
  tripOrigin: string | null;
  tripDestination: string | null;
  tripStartDate: string;
  tripEndDate: string;
  totalAmount: number;
  approvedAmount: number | null;
  status: string;
  itemCount: number;
}

function formatCurrency(cents: number) {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

function badge(status: string) {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'approved') return 'bg-sky-50 text-sky-700 ring-sky-200';
  if (status === 'rejected') return 'bg-rose-50 text-rose-700 ring-rose-200';
  return 'bg-amber-50 text-amber-700 ring-amber-200';
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

export default function Reimbursements() {
  const [rows, setRows] = useState<ReimbursementRow[]>([]);
  const [selected, setSelected] = useState<(ReimbursementRow & { items?: ReimbursementItem[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.getReimbursements({ limit: '50', search });
      setRows(response.items);
      if (response.items[0]) {
        const detail = await api.getReimbursementDetail(response.items[0].id);
        setSelected(detail);
      } else {
        setSelected(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [search]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += row.totalAmount;
        if (row.status === 'pending') acc.pending += row.totalAmount;
        if (row.status === 'paid') acc.paid += row.approvedAmount || row.totalAmount;
        return acc;
      },
      { total: 0, pending: 0, paid: 0 },
    );
  }, [rows]);

  const openDetail = async (id: string) => {
    const detail = await api.getReimbursementDetail(id);
    setSelected(detail);
  };

  if (loading) {
    return <div className="px-6 py-6 text-sm text-slate-500">Carregando reembolsos operacionais...</div>;
  }

  return (
    <div className="space-y-6 px-6 py-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-900 bg-slate-950 text-white shadow-2xl shadow-slate-950/15">
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.35fr_0.95fr] lg:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">Reembolsos</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight">Solicitações de viagem com rastreio por colaborador, roteiro e comprovante.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Esta visão segue a organização do módulo `IRB Finance`, mas já consumindo os lançamentos importados do financeiro real.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Solicitado</p>
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

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Surface
          title="Solicitações"
          subtitle="Lista importada dos formulários de reembolso."
          action={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por colaborador ou número"
                  className="w-64 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none"
                />
              </div>
              <button onClick={load} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
                <RefreshCw size={16} />
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            {rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                Nenhuma solicitação encontrada.
              </div>
            ) : (
              rows.map((row) => (
                <button
                  key={row.id}
                  onClick={() => openDetail(row.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selected?.id === row.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{row.requestNumber}</p>
                      <p className="mt-1 text-sm text-slate-500">{row.employeeName} · {row.employeeDepartment || 'Sem área'}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${badge(row.status)}`}>{row.status}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <p className="text-slate-500">
                      {row.tripOrigin || 'Origem não informada'} → {row.tripDestination || 'Destino não informado'}
                    </p>
                    <p className="font-semibold text-slate-900">{formatCurrency(row.approvedAmount || row.totalAmount)}</p>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {formatDate(row.tripStartDate)} a {formatDate(row.tripEndDate)} · {row.itemCount} itens
                  </p>
                </button>
              ))
            )}
          </div>
        </Surface>

        <Surface
          title="Detalhamento da solicitação"
          subtitle={selected ? `${selected.employeeName} · ${selected.requestNumber}` : 'Selecione uma solicitação para inspecionar os itens.'}
        >
          {!selected ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              Nenhum reembolso selecionado.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-3">
                    <UserCircle2 size={18} className="text-slate-500" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{selected.employeeName}</p>
                      <p className="text-xs text-slate-500">{selected.employeeDepartment || 'Sem área informada'}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center gap-3">
                    <CreditCard size={18} className="text-slate-500" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(selected.approvedAmount || selected.totalAmount)}</p>
                      <p className="text-xs text-slate-500">Total aprovado/solicitado</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200">
                <div className="border-b border-slate-200 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">Itens da solicitação</p>
                </div>
                <div className="divide-y divide-slate-200">
                  {(selected.items || []).map((item) => (
                    <div key={item.id} className="grid gap-3 px-4 py-3 md:grid-cols-[110px_1fr_120px_100px] md:items-center">
                      <p className="text-sm text-slate-500">{formatDate(item.expenseDate)}</p>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.description || item.expenseType}</p>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{item.expenseType}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(item.approvedAmount || item.amount)}</p>
                      <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${item.approved === false ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'}`}>
                        {item.approved === false ? 'Não aprovado' : 'Comprovado'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">
                <div className="flex items-center gap-2 text-slate-700">
                  <FileText size={16} />
                  Leitura operacional do roteiro
                </div>
                <p className="mt-2">
                  Período: {formatDate(selected.tripStartDate)} a {formatDate(selected.tripEndDate)} · rota {selected.tripOrigin || 'origem'} → {selected.tripDestination || 'destino'}.
                </p>
              </div>
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
}
