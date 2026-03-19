import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, CreditCard, Landmark, RefreshCw, Search, Wallet2 } from 'lucide-react';
import { api } from '../services/api';

interface DailyQueueItem {
  id: string;
  description: string;
  supplierName: string | null;
  costCenterName: string | null;
  dueDate: string;
  netAmount: number;
  status: string;
}

interface DailyQueueResponse {
  date: string;
  items: DailyQueueItem[];
  summary: {
    pendingCount: number;
    pendingTotalCents: number;
    approvedCount: number;
    approvedTotalCents: number;
  };
}

interface CreditCardPurchase {
  id: string;
  cardHolder: string | null;
  cardLastDigits: string | null;
  merchantName: string;
  purchaseDate: string;
  totalAmount: number;
  installments: number | null;
  installmentAmount: number;
  currentInstallment: number | null;
  status: string;
  description: string | null;
  costCenterName: string | null;
}

interface BankPosition {
  totalBalance: number;
  accounts: Array<{
    id: string;
    bankName: string;
    nickname: string;
    currentBalance: number;
    todayCredits: number;
    todayDebits: number;
  }>;
}

function formatCurrency(cents: number) {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

function statusTone(status: string) {
  if (status === 'paid') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'approved') return 'bg-sky-50 text-sky-700 ring-sky-200';
  if (status === 'overdue') return 'bg-rose-50 text-rose-700 ring-rose-200';
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

export default function DailyPayments() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<DailyQueueResponse | null>(null);
  const [bankPosition, setBankPosition] = useState<BankPosition | null>(null);
  const [cardPurchases, setCardPurchases] = useState<CreditCardPurchase[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [queueResponse, bankResponse, cardResponse] = await Promise.all([
        api.getDailyPaymentQueue(selectedDate),
        api.getBankPosition(selectedDate),
        api.getCreditCardPurchases({ limit: '8', status: 'active', search }),
      ]);
      setQueue(queueResponse);
      setBankPosition(bankResponse);
      setCardPurchases(cardResponse.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedDate, search]);

  const filteredQueue = useMemo(() => {
    if (!queue) return [];
    const term = search.trim().toLowerCase();
    if (!term) return queue.items;
    return queue.items.filter((item) =>
      [item.description, item.supplierName, item.costCenterName].some((value) => value?.toLowerCase().includes(term)),
    );
  }, [queue, search]);

  const handleApprove = async (id: string) => {
    await api.approvePayment(id);
    await load();
  };

  const handlePay = async (id: string) => {
    await api.payAccount(id, { paymentDate: selectedDate });
    await load();
  };

  const runway = (bankPosition?.totalBalance || 0) - ((queue?.summary.pendingTotalCents || 0) + (queue?.summary.approvedTotalCents || 0));

  if (loading) {
    return <div className="px-6 py-6 text-sm text-slate-500">Montando agenda financeira do dia...</div>;
  }

  return (
    <div className="space-y-6 px-6 py-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-900 bg-slate-950 text-white shadow-2xl shadow-slate-950/15">
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.4fr_0.95fr] lg:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">Pagamento Diário</p>
            <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight">O dia financeiro precisa começar com caixa, prioridades e ordem de execução.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Esta tela replica a estrutura operacional do módulo financeiro e cruza fila de pagamento, posição bancária e cartão corporativo.
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm text-slate-300">Data de trabalho</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none"
              />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Saldo Bancário</p>
                <p className="mt-2 text-2xl font-semibold">{formatCurrency(bankPosition?.totalBalance || 0)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Fila do Dia</p>
                <p className="mt-2 text-2xl font-semibold">{queue?.summary.pendingCount || 0}</p>
                <p className="mt-1 text-sm text-slate-300">{formatCurrency(queue?.summary.pendingTotalCents || 0)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Folga Após Execução</p>
                <p className={`mt-2 text-2xl font-semibold ${runway >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatCurrency(runway)}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Pendentes</span>
            <Wallet2 size={18} className="text-slate-500" />
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-amber-600">{queue?.summary.pendingCount || 0}</p>
          <p className="mt-3 text-sm text-slate-500">{formatCurrency(queue?.summary.pendingTotalCents || 0)} esperando aprovação ou pagamento.</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Aprovados</span>
            <CheckCircle2 size={18} className="text-slate-500" />
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-sky-600">{queue?.summary.approvedCount || 0}</p>
          <p className="mt-3 text-sm text-slate-500">{formatCurrency(queue?.summary.approvedTotalCents || 0)} prontos para baixa.</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Contas Bancárias</span>
            <Landmark size={18} className="text-slate-500" />
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{bankPosition?.accounts.length || 0}</p>
          <p className="mt-3 text-sm text-slate-500">Posição consolidada do dia para distribuir execução.</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Cartão Corporativo</span>
            <CreditCard size={18} className="text-slate-500" />
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-violet-600">{cardPurchases.length}</p>
          <p className="mt-3 text-sm text-slate-500">Compras ativas já puxadas para compor a agenda financeira.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Surface
          title="Fila de execução"
          subtitle={`Contas vencidas até ${formatDate(queue?.date || selectedDate)} com ação imediata.`}
          action={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar fornecedor ou descrição"
                  className="w-64 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none"
                />
              </div>
              <button onClick={load} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
                <RefreshCw size={16} />
              </button>
            </div>
          }
        >
          {filteredQueue.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              Nenhuma conta encontrada para a data e filtro atual.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredQueue.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{item.description}</p>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusTone(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">{item.supplierName || 'Sem fornecedor'} · {item.costCenterName || 'Sem centro de custo'} · vence em {formatDate(item.dueDate)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-[140px] text-right text-lg font-semibold text-slate-900">{formatCurrency(item.netAmount)}</p>
                      {item.status === 'pending' ? (
                        <button onClick={() => handleApprove(item.id)} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
                          Aprovar
                        </button>
                      ) : null}
                      {(item.status === 'approved' || item.status === 'overdue') ? (
                        <button onClick={() => handlePay(item.id)} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-500">
                          Baixar hoje
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Surface>

        <div className="space-y-6">
          <Surface title="Posição bancária" subtitle="Movimento por conta para decidir de onde sai cada pagamento.">
            <div className="space-y-3">
              {(bankPosition?.accounts || []).map((account) => (
                <div key={account.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{account.nickname}</p>
                      <p className="text-xs text-slate-500">{account.bankName}</p>
                    </div>
                    <p className="text-base font-semibold text-slate-900">{formatCurrency(account.currentBalance)}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Entradas</p>
                      <p className="mt-1 font-medium text-emerald-600">{formatCurrency(account.todayCredits)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Saídas</p>
                      <p className="mt-1 font-medium text-rose-600">{formatCurrency(account.todayDebits)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Surface>

          <Surface title="Cartão corporativo" subtitle="Compras importadas da planilha operacional do financeiro.">
            <div className="space-y-3">
              {cardPurchases.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                  Nenhuma compra ativa encontrada.
                </div>
              ) : (
                cardPurchases.map((purchase) => (
                  <div key={purchase.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{purchase.merchantName}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {purchase.cardHolder || 'Cartão corporativo'} {purchase.cardLastDigits ? `···· ${purchase.cardLastDigits}` : ''} · {formatDate(purchase.purchaseDate)}
                        </p>
                      </div>
                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-violet-200">
                        {purchase.currentInstallment || 1}/{purchase.installments || 1}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">{purchase.costCenterName || 'Sem centro de custo'}</p>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">{formatCurrency(purchase.totalAmount)}</p>
                        <p className="text-xs text-slate-500">Parcela {formatCurrency(purchase.installmentAmount)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
}
