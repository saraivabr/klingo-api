import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Eye,
  Landmark,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import { api } from '../services/api';

interface AccountPayable {
  id: string;
  documentNumber: string | null;
  documentType: string | null;
  description: string;
  grossAmount: number;
  netAmount: number;
  dueDate: string;
  paymentDate: string | null;
  status: string;
  paymentMethod: string | null;
  supplierName: string | null;
  costCenterName: string | null;
  chartAccountName: string | null;
  createdAt: string;
}

interface PayablesResponse {
  items: AccountPayable[];
  total: number;
  totalGrossCents: number;
  totalNetCents: number;
}

interface CostCenter {
  id: string;
  name: string;
}

interface DailyQueueItem {
  id: string;
  description: string;
  supplierName: string | null;
  costCenterName: string | null;
  dueDate: string;
  netAmount: number;
  status: string;
}

interface DailyQueue {
  date: string;
  items: DailyQueueItem[];
  summary: {
    pendingCount: number;
    pendingTotalCents: number;
    approvedCount: number;
    approvedTotalCents: number;
  };
}

interface OverdueItem {
  id: string;
  description: string;
  supplierName: string | null;
  dueDate: string;
  balance?: number;
  netAmount?: number;
  status: string;
  daysOverdue?: number;
}

interface OverduePayload {
  items: OverdueItem[];
  totalOverdueCents: number;
  overdueCount: number;
}

const PAGE_SIZE = 20;
const INPUT_CLASS = 'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white';

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  approved: { label: 'Aprovado', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
  paid: { label: 'Pago', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  overdue: { label: 'Em atraso', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
  cancelled: { label: 'Cancelado', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

function formatCurrency(cents: number) {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

function isOverdue(dueDate: string, status: string) {
  if (status === 'paid' || status === 'cancelled') return false;
  return new Date(dueDate) < new Date(new Date().toISOString().slice(0, 10));
}

function StatCard({
  icon: Icon,
  eyebrow,
  value,
  support,
  tone,
}: {
  icon: React.ElementType;
  eyebrow: string;
  value: string;
  support: string;
  tone: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
          <p className={`mt-3 text-3xl font-semibold tracking-tight ${tone}`}>{value}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-700">
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-500">{support}</p>
    </div>
  );
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
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${meta.className}`}>{meta.label}</span>;
}

export default function AccountsPayable() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AccountPayable[]>([]);
  const [total, setTotal] = useState(0);
  const [totalNet, setTotalNet] = useState(0);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [chartAccounts, setChartAccounts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [dailyQueue, setDailyQueue] = useState<DailyQueue | null>(null);
  const [overdue, setOverdue] = useState<OverduePayload | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [createForm, setCreateForm] = useState({
    description: '',
    grossAmount: '',
    dueDate: '',
    issueDate: '',
    documentType: 'invoice',
    documentNumber: '',
    supplierId: '',
    costCenterId: '',
    chartAccountId: '',
    bankAccountId: '',
    paymentMethod: 'transfer',
    notes: '',
  });

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [costCenterFilter, setCostCenterFilter] = useState('');
  const [dueDateFrom, setDueDateFrom] = useState('');
  const [dueDateTo, setDueDateTo] = useState('');

  const loadOverview = async () => {
    try {
      const [queueResponse, overdueResponse, centersResponse, chartResponse, suppliersResponse, banksResponse] = await Promise.all([
        api.getDailyPaymentQueue(),
        api.getOverduePayables(),
        api.getCostCenters(),
        api.getChartOfAccounts('expense'),
        api.getSuppliers(),
        api.getBankAccounts(),
      ]);

      setDailyQueue(queueResponse);
      setOverdue(overdueResponse);
      setCostCenters(centersResponse.items);
      setChartAccounts(chartResponse.items);
      setSuppliers(suppliersResponse.items);
      setBankAccounts(banksResponse.items);
    } catch (err: any) {
      console.error('AP overview load error:', err);
      setError(err.message || 'Erro ao carregar dados');
      setTimeout(() => setError(null), 5000);
    }
  };

  const loadTable = async () => {
    const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (costCenterFilter) params.costCenterId = costCenterFilter;
    if (dueDateFrom) params.dueDateFrom = dueDateFrom;
    if (dueDateTo) params.dueDateTo = dueDateTo;

    const response: PayablesResponse = await api.getAccountsPayable(params);
    setItems(response.items);
    setTotal(response.total);
    setTotalNet(response.totalNetCents);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadOverview(), loadTable()]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [page, search, statusFilter, costCenterFilter, dueDateFrom, dueDateTo]);

  const pageMetrics = useMemo(() => {
    const approvedValue = items.filter((item) => item.status === 'approved').reduce((sum, item) => sum + item.netAmount, 0);
    const paidValue = items.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.netAmount, 0);
    const pendingValue = items.filter((item) => item.status === 'pending' || item.status === 'overdue').reduce((sum, item) => sum + item.netAmount, 0);
    return { approvedValue, paidValue, pendingValue };
  }, [items]);

  const handleApprove = async (id: string) => {
    if (!window.confirm('Aprovar este pagamento?')) return;
    try {
      await api.approvePayment(id);
      await loadAll();
    } catch (err: any) {
      console.error('Approve error:', err);
      setError(err.message || 'Erro ao aprovar pagamento');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handlePay = async (id: string) => {
    if (!window.confirm('Registrar esse pagamento como pago hoje?')) return;
    try {
      await api.payAccount(id, { paymentDate: new Date().toISOString().slice(0, 10) });
      await loadAll();
    } catch (err: any) {
      console.error('Pay error:', err);
      setError(err.message || 'Erro ao registrar pagamento');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancelar esta conta a pagar?')) return;
    try {
      await api.cancelAccountPayable(id);
      await loadAll();
    } catch (err: any) {
      console.error('Cancel error:', err);
      setError(err.message || 'Erro ao cancelar conta');
      setTimeout(() => setError(null), 5000);
    }
  };

  const openDetail = async (id: string) => {
    try {
      const response = await api.getAccountPayable(id);
      setSelectedItem(response);
      setDetailOpen(true);
    } catch (err: any) {
      console.error('Detail load error:', err);
      setError(err.message || 'Erro ao carregar detalhes');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleCreateAccount = async () => {
    if (!createForm.description.trim() || !createForm.grossAmount || !createForm.dueDate) {
      setCreateError('Descrição, valor bruto e vencimento são obrigatórios.');
      return;
    }

    setCreateSaving(true);
    setCreateError('');
    try {
      await api.createAccountPayable({
        description: createForm.description.trim(),
        grossAmount: Math.round(Number(createForm.grossAmount.replace(',', '.')) * 100),
        dueDate: createForm.dueDate,
        issueDate: createForm.issueDate || undefined,
        documentType: createForm.documentType || undefined,
        documentNumber: createForm.documentNumber.trim() || undefined,
        supplierId: createForm.supplierId || undefined,
        costCenterId: createForm.costCenterId || undefined,
        chartAccountId: createForm.chartAccountId || undefined,
        bankAccountId: createForm.bankAccountId || undefined,
        paymentMethod: createForm.paymentMethod || undefined,
        notes: createForm.notes.trim() || undefined,
      });

      setCreateSuccess('Conta criada e enviada para a fila financeira.');
      setCreateOpen(false);
      setCreateForm({
        description: '',
        grossAmount: '',
        dueDate: '',
        issueDate: '',
        documentType: 'invoice',
        documentNumber: '',
        supplierId: '',
        costCenterId: '',
        chartAccountId: '',
        bankAccountId: '',
        paymentMethod: 'transfer',
        notes: '',
      });
      await loadAll();
      setTimeout(() => setCreateSuccess(''), 3000);
    } catch (err: any) {
      setCreateError(err.message || 'Falha ao criar conta a pagar');
    } finally {
      setCreateSaving(false);
    }
  };

  const heroCount = overdue?.overdueCount || dailyQueue?.summary.pendingCount || 0;

  return (
    <div className="space-y-6 px-6 py-6">
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}
      <section className="overflow-hidden rounded-[28px] border border-slate-900 bg-slate-950 text-white shadow-2xl shadow-slate-950/15">
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.35fr_0.95fr] lg:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300/80">Contas a Pagar</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">A tela precisa mostrar pressão de caixa, não só uma lista de lançamentos.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Aqui a leitura começa pela urgência. O que vence, o que já atrasou e o que ainda depende de aprovação ficam visíveis antes da tabela.
            </p>
          </div>

          <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <span className="text-sm text-slate-300">Fila do dia</span>
              <span className="text-xl font-semibold text-amber-300">{dailyQueue?.summary.pendingCount || 0}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <span className="text-sm text-slate-300">Aprovados para pagar</span>
              <span className="text-xl font-semibold text-sky-300">{formatCurrency(dailyQueue?.summary.approvedTotalCents || 0)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <span className="text-sm text-slate-300">Contas em estresse</span>
              <span className="text-xl font-semibold text-rose-300">{heroCount}</span>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 px-6 pb-6 lg:px-8">
          <button
            onClick={() => {
              setCreateError('');
              setCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-amber-50"
          >
            <Plus size={16} />
            Novo lançamento
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={WalletCards}
          eyebrow="Exposição Filtrada"
          value={formatCurrency(totalNet)}
          support={`${total} lançamentos na leitura atual.`}
          tone="text-slate-900"
        />
        <StatCard
          icon={AlertTriangle}
          eyebrow="Em Atraso"
          value={formatCurrency(overdue?.totalOverdueCents || 0)}
          support={`${overdue?.overdueCount || 0} contas já vencidas pressionando caixa.`}
          tone="text-rose-600"
        />
        <StatCard
          icon={CheckCircle2}
          eyebrow="Prontas Para Pagamento"
          value={formatCurrency(dailyQueue?.summary.approvedTotalCents || pageMetrics.approvedValue)}
          support={`${dailyQueue?.summary.approvedCount || 0} títulos aprovados e aguardando baixa.`}
          tone="text-sky-600"
        />
        <StatCard
          icon={Landmark}
          eyebrow="Pendência Operacional"
          value={formatCurrency(pageMetrics.pendingValue)}
          support={`${formatCurrency(pageMetrics.paidValue)} já baixados nesta página.`}
          tone="text-amber-600"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
        <Surface
          title="Radar de urgência"
          subtitle="Itens que pedem decisão agora."
          action={
            <button
              onClick={loadAll}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition-colors hover:text-slate-900"
            >
              <RefreshCw size={16} />
              Atualizar
            </button>
          }
        >
          <div className="space-y-3">
            {(overdue?.items || []).slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-slate-900">{item.description}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.supplierName || 'Fornecedor não informado'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-rose-700">{formatCurrency(item.netAmount || item.balance || 0)}</p>
                    <p className="mt-1 text-xs text-rose-600">Vencido em {formatDate(item.dueDate)}</p>
                  </div>
                </div>
              </div>
            ))}
            {(!overdue || overdue.items.length === 0) && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-5 text-sm text-emerald-700">
                Sem contas vencidas nesta leitura.
              </div>
            )}
          </div>
        </Surface>

        <Surface title="Fila operacional" subtitle="O que precisa de aprovação ou baixa imediata.">
          <div className="space-y-3">
            {(dailyQueue?.items || []).slice(0, 6).map((item) => (
              <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{item.description}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.supplierName || 'Sem fornecedor'}
                    {item.costCenterName ? ` • ${item.costCenterName}` : ''}
                  </p>
                </div>
                <div className="min-w-[160px] text-left md:text-right">
                  <p className="font-semibold text-slate-900">{formatCurrency(item.netAmount)}</p>
                  <p className={`mt-1 text-xs ${isOverdue(item.dueDate, item.status) ? 'text-rose-600' : 'text-slate-500'}`}>
                    Vencimento {formatDate(item.dueDate)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {item.status === 'pending' && (
                    <button
                      onClick={() => handleApprove(item.id)}
                      className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
                    >
                      <CheckCircle2 size={15} />
                      Aprovar
                    </button>
                  )}
                  {(item.status === 'approved' || item.status === 'overdue') && (
                    <button
                      onClick={() => handlePay(item.id)}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                    >
                      <CircleDollarSign size={15} />
                      Baixar
                    </button>
                  )}
                </div>
              </div>
            ))}
            {(!dailyQueue || dailyQueue.items.length === 0) && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Nenhuma conta pendente ou aprovada para hoje.
              </div>
            )}
          </div>
        </Surface>
      </section>

      <Surface title="Leitura detalhada" subtitle="Filtro leve para operação diária, sem esconder o essencial.">
        {createSuccess && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {createSuccess}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Buscar por descrição ou documento"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 outline-none transition focus:border-slate-400"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => {
              setPage(1);
              setStatusFilter(event.target.value);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option value="">Todos os status</option>
            <option value="pending">Pendente</option>
            <option value="approved">Aprovado</option>
            <option value="overdue">Em atraso</option>
            <option value="paid">Pago</option>
            <option value="cancelled">Cancelado</option>
          </select>

          <select
            value={costCenterFilter}
            onChange={(event) => {
              setPage(1);
              setCostCenterFilter(event.target.value);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option value="">Todos os centros</option>
            {costCenters.map((center) => (
              <option key={center.id} value={center.id}>
                {center.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dueDateFrom}
            onChange={(event) => {
              setPage(1);
              setDueDateFrom(event.target.value);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          />
          <input
            type="date"
            value={dueDateTo}
            onChange={(event) => {
              setPage(1);
              setDueDateTo(event.target.value);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 text-slate-500">
              <tr>
                <th className="px-3 py-3 text-left font-medium">Lançamento</th>
                <th className="px-3 py-3 text-left font-medium">Fornecedor</th>
                <th className="px-3 py-3 text-left font-medium">Centro</th>
                <th className="px-3 py-3 text-right font-medium">Líquido</th>
                <th className="px-3 py-3 text-left font-medium">Vencimento</th>
                <th className="px-3 py-3 text-left font-medium">Status</th>
                <th className="px-3 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80">
                  <td className="px-3 py-4">
                    <p className="font-medium text-slate-900">{item.description}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.documentType || 'Doc'} {item.documentNumber || 'sem número'}
                      {item.chartAccountName ? ` • ${item.chartAccountName}` : ''}
                    </p>
                  </td>
                  <td className="px-3 py-4 text-slate-600">{item.supplierName || '-'}</td>
                  <td className="px-3 py-4 text-slate-600">{item.costCenterName || '-'}</td>
                  <td className="px-3 py-4 text-right font-medium text-slate-900">{formatCurrency(item.netAmount)}</td>
                  <td className={`px-3 py-4 ${isOverdue(item.dueDate, item.status) ? 'font-medium text-rose-600' : 'text-slate-600'}`}>
                    {formatDate(item.dueDate)}
                  </td>
                  <td className="px-3 py-4">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openDetail(item.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-slate-600 hover:text-slate-900"
                      >
                        <Eye size={15} />
                      </button>
                      {item.status === 'pending' && (
                        <button
                          onClick={() => handleApprove(item.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-2 text-white hover:bg-sky-700"
                        >
                          <CheckCircle2 size={15} />
                        </button>
                      )}
                      {(item.status === 'approved' || item.status === 'overdue') && (
                        <button
                          onClick={() => handlePay(item.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-2 text-white hover:bg-emerald-700"
                        >
                          <CircleDollarSign size={15} />
                        </button>
                      )}
                      {item.status !== 'paid' && item.status !== 'cancelled' && (
                        <button
                          onClick={() => handleCancel(item.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-slate-500 hover:text-rose-700"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm text-slate-500">
                    Nenhuma conta encontrada para esse recorte.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm text-slate-500">
          <span>
            Mostrando {items.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} até {Math.min(page * PAGE_SIZE, total)} de {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="rounded-xl border border-slate-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((current) => current + 1)}
              disabled={page * PAGE_SIZE >= total}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Próxima
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </Surface>

      {detailOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Detalhe da conta</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{selectedItem.description}</h3>
                <p className="mt-2 text-sm text-slate-500">{selectedItem.supplierName || 'Fornecedor não informado'}</p>
              </div>
              <button onClick={() => setDetailOpen(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
                Fechar
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Valor líquido</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(selectedItem.netAmount)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Vencimento</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{formatDate(selectedItem.dueDate)}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <DetailField label="Centro de custo" value={selectedItem.costCenterName} />
              <DetailField label="Conta contábil" value={selectedItem.chartAccountName} />
              <DetailField label="Documento" value={selectedItem.documentNumber} />
              <DetailField label="Forma de pagamento" value={selectedItem.paymentMethod} />
              <DetailField label="Status" value={STATUS_META[selectedItem.status]?.label || selectedItem.status} />
              <DetailField label="Baixa" value={formatDate(selectedItem.paymentDate)} />
            </div>

            {selectedItem.notes && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Observações</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{selectedItem.notes}</p>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {selectedItem.status === 'pending' && (
                <button
                  onClick={async () => {
                    await handleApprove(selectedItem.id);
                    setDetailOpen(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white hover:bg-sky-700"
                >
                  <CheckCircle2 size={16} />
                  Aprovar
                </button>
              )}
              {(selectedItem.status === 'approved' || selectedItem.status === 'overdue') && (
                <button
                  onClick={async () => {
                    await handlePay(selectedItem.id);
                    setDetailOpen(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <CircleDollarSign size={16} />
                  Registrar pagamento
                </button>
              )}
              {selectedItem.status !== 'paid' && selectedItem.status !== 'cancelled' && (
                <button
                  onClick={async () => {
                    await handleCancel(selectedItem.id);
                    setDetailOpen(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:text-rose-700"
                >
                  <Trash2 size={16} />
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Novo lançamento</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Adicionar conta a pagar</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Lance a despesa com contexto financeiro suficiente para aprovação, baixa e leitura de caixa.
                </p>
              </div>
              <button onClick={() => setCreateOpen(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
                <X size={16} />
              </button>
            </div>

            {createError && (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {createError}
              </div>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <FormField label="Descrição">
                <input value={createForm.description} onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))} className={INPUT_CLASS} />
              </FormField>
              <FormField label="Valor bruto (R$)">
                <input type="number" min="0" step="0.01" value={createForm.grossAmount} onChange={(event) => setCreateForm((current) => ({ ...current, grossAmount: event.target.value }))} className={INPUT_CLASS} />
              </FormField>
              <FormField label="Vencimento">
                <input type="date" value={createForm.dueDate} onChange={(event) => setCreateForm((current) => ({ ...current, dueDate: event.target.value }))} className={INPUT_CLASS} />
              </FormField>
              <FormField label="Emissão">
                <input type="date" value={createForm.issueDate} onChange={(event) => setCreateForm((current) => ({ ...current, issueDate: event.target.value }))} className={INPUT_CLASS} />
              </FormField>
              <FormField label="Tipo de documento">
                <select value={createForm.documentType} onChange={(event) => setCreateForm((current) => ({ ...current, documentType: event.target.value }))} className={INPUT_CLASS}>
                  <option value="invoice">Nota / fatura</option>
                  <option value="boleto">Boleto</option>
                  <option value="contract">Contrato</option>
                  <option value="receipt">Recibo</option>
                </select>
              </FormField>
              <FormField label="Número do documento">
                <input value={createForm.documentNumber} onChange={(event) => setCreateForm((current) => ({ ...current, documentNumber: event.target.value }))} className={INPUT_CLASS} />
              </FormField>
              <FormField label="Fornecedor">
                <select value={createForm.supplierId} onChange={(event) => setCreateForm((current) => ({ ...current, supplierId: event.target.value }))} className={INPUT_CLASS}>
                  <option value="">Selecionar depois</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.legalName}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Centro de custo">
                <select value={createForm.costCenterId} onChange={(event) => setCreateForm((current) => ({ ...current, costCenterId: event.target.value }))} className={INPUT_CLASS}>
                  <option value="">Selecionar</option>
                  {costCenters.map((center) => (
                    <option key={center.id} value={center.id}>{center.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Conta contábil">
                <select value={createForm.chartAccountId} onChange={(event) => setCreateForm((current) => ({ ...current, chartAccountId: event.target.value }))} className={INPUT_CLASS}>
                  <option value="">Selecionar</option>
                  {chartAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.code ? `${account.code} • ` : ''}{account.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Conta bancária">
                <select value={createForm.bankAccountId} onChange={(event) => setCreateForm((current) => ({ ...current, bankAccountId: event.target.value }))} className={INPUT_CLASS}>
                  <option value="">Definir na baixa</option>
                  {bankAccounts.map((bank) => (
                    <option key={bank.id} value={bank.id}>{bank.nickname || bank.bankName}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Forma de pagamento">
                <select value={createForm.paymentMethod} onChange={(event) => setCreateForm((current) => ({ ...current, paymentMethod: event.target.value }))} className={INPUT_CLASS}>
                  <option value="transfer">Transferência</option>
                  <option value="pix">PIX</option>
                  <option value="boleto">Boleto</option>
                  <option value="credit_card">Cartão</option>
                  <option value="cash">Dinheiro</option>
                </select>
              </FormField>
              <FormField label="Observações">
                <textarea value={createForm.notes} onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))} rows={4} className={INPUT_CLASS} />
              </FormField>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={handleCreateAccount} disabled={createSaving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                <Plus size={16} />
                {createSaving ? 'Salvando...' : 'Criar conta'}
              </button>
              <button onClick={() => setCreateOpen(false)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm text-slate-700">{value || '-'}</p>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
