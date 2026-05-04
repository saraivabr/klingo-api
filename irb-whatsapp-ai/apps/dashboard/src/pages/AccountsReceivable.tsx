import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCent,
  CheckCircle2,
  Eye,
  Landmark,
  PieChart,
  Plus,
  RefreshCw,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import { api } from '../services/api';

interface AccountReceivable {
  id: string;
  patientName: string | null;
  doctorName: string | null;
  insuranceName: string | null;
  serviceType: string;
  procedureDescription: string | null;
  guideNumber: string | null;
  totalAmount: number;
  receivedAmount: number;
  glosaAmount: number;
  serviceDate: string;
  dueDate: string;
  status: string;
  paymentType: string;
  balance: number;
}

interface Summary {
  totalAmountCents: number;
  receivedAmountCents: number;
  glosaAmountCents: number;
  balanceCents: number;
}

interface InsuranceProvider {
  id: string;
  name: string;
}

interface AgingBucket {
  range: string;
  count: number;
  totalCents: number;
}

interface ReceivablesResponse {
  items: AccountReceivable[];
  total: number;
  summary: Summary;
}

interface OverdueItem {
  id: string;
  patientName: string | null;
  insuranceName: string | null;
  totalAmount: number;
  receivedAmount: number;
  balance: number;
  dueDate: string;
  paymentType: string;
  status: string;
}

const PAGE_SIZE = 20;
const INPUT_CLASS = 'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white';

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  partial: { label: 'Parcial', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
  received: { label: 'Recebido', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  overdue: { label: 'Em atraso', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
  glosa: { label: 'Glosa', className: 'bg-orange-50 text-orange-700 ring-orange-200' },
  cancelled: { label: 'Cancelado', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

const PAYMENT_TYPE_META: Record<string, string> = {
  particular: 'Particular',
  insurance: 'Convênio',
  sus: 'SUS',
};

const SERVICE_TYPE_META: Record<string, string> = {
  consultation: 'Consulta',
  exam: 'Exame',
  procedure: 'Procedimento',
  surgery: 'Cirurgia',
  hospitalization: 'Internação',
  other: 'Outro',
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
  if (status === 'received' || status === 'cancelled') return false;
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

export default function AccountsReceivable() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AccountReceivable[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary>({
    totalAmountCents: 0,
    receivedAmountCents: 0,
    glosaAmountCents: 0,
    balanceCents: 0,
  });
  const [aging, setAging] = useState<AgingBucket[]>([]);
  const [overdue, setOverdue] = useState<{ items: OverdueItem[]; totalOverdueCents: number; overdueCount: number } | null>(null);
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveMethod, setReceiveMethod] = useState('transfer');
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [createForm, setCreateForm] = useState({
    patientId: '',
    doctorId: '',
    insuranceProviderId: '',
    costCenterId: '',
    serviceType: 'consultation',
    procedureCode: '',
    procedureDescription: '',
    guideNumber: '',
    authorizationNumber: '',
    totalAmount: '',
    serviceDate: '',
    dueDate: '',
    paymentType: 'particular',
    installments: '1',
    notes: '',
  });

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('');
  const [insuranceFilter, setInsuranceFilter] = useState('');
  const [dueDateFrom, setDueDateFrom] = useState('');
  const [dueDateTo, setDueDateTo] = useState('');

  const loadOverview = async () => {
    try {
      const [agingResponse, overdueResponse, insurersResponse, centersResponse, patientsResponse, doctorsResponse] = await Promise.all([
        api.getReceivablesAging(),
        api.getOverdueReceivables(),
        api.getInsuranceProviders(),
        api.getCostCenters(),
        api.getPatients({ limit: '100' }),
        api.getDoctors({ isActive: 'true' }),
      ]);

      setAging(agingResponse.buckets || []);
      setOverdue(overdueResponse);
      setInsuranceProviders(insurersResponse.items);
      setCostCenters(centersResponse.items);
      setPatients(patientsResponse.patients);
      setDoctors(doctorsResponse.doctors);
    } catch (err: any) {
      console.error('AR overview load error:', err);
      setError(err.message || 'Erro ao carregar dados');
      setTimeout(() => setError(null), 5000);
    }
  };

  const loadTable = async () => {
    const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (paymentTypeFilter) params.paymentType = paymentTypeFilter;
    if (insuranceFilter) params.insuranceProviderId = insuranceFilter;
    if (dueDateFrom) params.dueDateFrom = dueDateFrom;
    if (dueDateTo) params.dueDateTo = dueDateTo;

    const response: ReceivablesResponse = await api.getAccountsReceivable(params);
    setItems(response.items);
    setTotal(response.total);
    setSummary(response.summary);
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
  }, [page, search, statusFilter, paymentTypeFilter, insuranceFilter, dueDateFrom, dueDateTo]);

  const pageInsights = useMemo(() => {
    const pageOpen = items.reduce((sum, item) => sum + item.balance, 0);
    const insuranceValue = items.filter((item) => item.paymentType === 'insurance').reduce((sum, item) => sum + item.balance, 0);
    return { pageOpen, insuranceValue };
  }, [items]);

  const openDetail = async (id: string) => {
    try {
      const response = await api.getAccountReceivable(id);
      setSelectedItem(response);
      setDetailOpen(true);
    } catch (err: any) {
      console.error('Detail load error:', err);
      setError(err.message || 'Erro ao carregar detalhes');
      setTimeout(() => setError(null), 5000);
    }
  };

  const openReceive = async (id: string) => {
    try {
      const response = await api.getAccountReceivable(id);
      const balance = (response.totalAmount || 0) - (response.receivedAmount || 0) - (response.glosaAmount || 0);
      setSelectedItem(response);
      setReceiveAmount((balance / 100).toFixed(2));
      setReceiveMethod('transfer');
      setReceiveOpen(true);
    } catch (err: any) {
      console.error('Open receive error:', err);
      setError(err.message || 'Erro ao carregar recebimento');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleReceive = async () => {
    if (!selectedItem) return;
    const amount = Math.round(Number(receiveAmount.replace(',', '.')) * 100);
    if (!amount || amount <= 0) return;
    try {
      await api.receivePayment(selectedItem.id, {
        amount,
        paymentMethod: receiveMethod,
        paymentDate: new Date().toISOString().slice(0, 10),
      });
      setReceiveOpen(false);
      setSelectedItem(null);
      await loadAll();
    } catch (err: any) {
      console.error('Receive payment error:', err);
      setError(err.message || 'Erro ao registrar recebimento');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleCreateReceivable = async () => {
    if (!createForm.serviceType || !createForm.totalAmount || !createForm.serviceDate || !createForm.dueDate || !createForm.paymentType) {
      setCreateError('Preencha tipo de serviço, valor, data do serviço, vencimento e tipo de cobrança.');
      return;
    }

    setCreateSaving(true);
    setCreateError('');
    try {
      await api.createAccountReceivable({
        patientId: createForm.patientId || undefined,
        doctorId: createForm.doctorId || undefined,
        insuranceProviderId: createForm.paymentType === 'insurance' ? createForm.insuranceProviderId || undefined : undefined,
        costCenterId: createForm.costCenterId || undefined,
        serviceType: createForm.serviceType,
        procedureCode: createForm.procedureCode.trim() || undefined,
        procedureDescription: createForm.procedureDescription.trim() || undefined,
        guideNumber: createForm.guideNumber.trim() || undefined,
        authorizationNumber: createForm.authorizationNumber.trim() || undefined,
        totalAmount: Math.round(Number(createForm.totalAmount.replace(',', '.')) * 100),
        serviceDate: createForm.serviceDate,
        dueDate: createForm.dueDate,
        paymentType: createForm.paymentType,
        installments: createForm.installments ? Number(createForm.installments) : undefined,
        notes: createForm.notes.trim() || undefined,
      });

      setCreateSuccess('Conta a receber criada com sucesso.');
      setCreateOpen(false);
      setCreateForm({
        patientId: '',
        doctorId: '',
        insuranceProviderId: '',
        costCenterId: '',
        serviceType: 'consultation',
        procedureCode: '',
        procedureDescription: '',
        guideNumber: '',
        authorizationNumber: '',
        totalAmount: '',
        serviceDate: '',
        dueDate: '',
        paymentType: 'particular',
        installments: '1',
        notes: '',
      });
      await loadAll();
      setTimeout(() => setCreateSuccess(''), 3000);
    } catch (err: any) {
      setCreateError(err.message || 'Falha ao criar conta a receber');
    } finally {
      setCreateSaving(false);
    }
  };

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
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">Contas a Receber</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">Recebimento com aging, atraso e composição da carteira no mesmo plano de leitura.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              A tela deixa de ser uma tabela vazia e passa a mostrar o que está preso, o que já entrou e onde a cobrança precisa ser acelerada.
            </p>
          </div>

          <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <span className="text-sm text-slate-300">Saldo em aberto</span>
              <span className="text-xl font-semibold text-cyan-300">{formatCurrency(summary.balanceCents)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <span className="text-sm text-slate-300">Recebido</span>
              <span className="text-xl font-semibold text-emerald-300">{formatCurrency(summary.receivedAmountCents)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <span className="text-sm text-slate-300">Atrasado</span>
              <span className="text-xl font-semibold text-rose-300">{overdue?.overdueCount || 0}</span>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 px-6 pb-6 lg:px-8">
          <button
            onClick={() => {
              setCreateError('');
              setCreateOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-cyan-50"
          >
            <Plus size={16} />
            Novo recebível
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Wallet}
          eyebrow="Carteira Bruta"
          value={formatCurrency(summary.totalAmountCents)}
          support={`${total} títulos na leitura atual.`}
          tone="text-slate-900"
        />
        <StatCard
          icon={CheckCircle2}
          eyebrow="Recebido"
          value={formatCurrency(summary.receivedAmountCents)}
          support="Baixas registradas na carteira filtrada."
          tone="text-emerald-600"
        />
        <StatCard
          icon={AlertTriangle}
          eyebrow="Em Atraso"
          value={formatCurrency(overdue?.totalOverdueCents || 0)}
          support={`${overdue?.overdueCount || 0} títulos vencidos ainda abertos.`}
          tone="text-rose-600"
        />
        <StatCard
          icon={Landmark}
          eyebrow="Dependência de Convênio"
          value={formatCurrency(pageInsights.insuranceValue)}
          support={`${formatCurrency(summary.glosaAmountCents)} em glosa e ${formatCurrency(pageInsights.pageOpen)} em aberto na página.`}
          tone="text-violet-600"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.45fr]">
        <Surface
          title="Mapa de vencimento"
          subtitle="Buckets de aging para leitura rápida da carteira."
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
          <div className="grid gap-3">
            {aging.map((bucket, index) => {
              const tones = [
                'border-emerald-200 bg-emerald-50 text-emerald-700',
                'border-amber-200 bg-amber-50 text-amber-700',
                'border-orange-200 bg-orange-50 text-orange-700',
                'border-rose-200 bg-rose-50 text-rose-700',
              ];
              return (
                <div key={bucket.range} className={`rounded-2xl border p-4 ${tones[index] || tones[3]}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{bucket.range}</p>
                      <p className="mt-2 text-2xl font-semibold">{formatCurrency(bucket.totalCents)}</p>
                    </div>
                    <PieChart size={18} />
                  </div>
                  <p className="mt-3 text-xs">{bucket.count} títulos</p>
                </div>
              );
            })}
            {aging.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Sem dados de aging para exibir.
              </div>
            )}
          </div>
        </Surface>

        <Surface title="Cobrança em risco" subtitle="Itens vencidos que precisam de baixa ou negociação imediata.">
          <div className="space-y-3">
            {(overdue?.items || []).slice(0, 6).map((item) => (
              <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{item.patientName || 'Paciente não informado'}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.insuranceName || PAYMENT_TYPE_META[item.paymentType] || 'Origem não informada'}
                  </p>
                </div>
                <div className="min-w-[180px] text-left md:text-right">
                  <p className="font-semibold text-rose-700">{formatCurrency(item.balance)}</p>
                  <p className="mt-1 text-xs text-rose-600">Vencido em {formatDate(item.dueDate)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openDetail(item.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:text-slate-900"
                  >
                    <Eye size={15} />
                    Ver
                  </button>
                  <button
                    onClick={() => openReceive(item.id)}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    <BadgeCent size={15} />
                    Baixar
                  </button>
                </div>
              </div>
            ))}
            {(!overdue || overdue.items.length === 0) && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-5 text-sm text-emerald-700">
                Sem recebíveis vencidos neste momento.
              </div>
            )}
          </div>
        </Surface>
      </section>

      <Surface title="Carteira detalhada" subtitle="Busca, recorte por convênio e ação de baixa sem perder contexto financeiro.">
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
              placeholder="Buscar por guia ou procedimento"
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
            <option value="partial">Parcial</option>
            <option value="overdue">Em atraso</option>
            <option value="received">Recebido</option>
            <option value="glosa">Glosa</option>
            <option value="cancelled">Cancelado</option>
          </select>

          <select
            value={paymentTypeFilter}
            onChange={(event) => {
              setPage(1);
              setPaymentTypeFilter(event.target.value);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option value="">Todos os tipos</option>
            <option value="particular">Particular</option>
            <option value="insurance">Convênio</option>
            <option value="sus">SUS</option>
          </select>

          <select
            value={insuranceFilter}
            onChange={(event) => {
              setPage(1);
              setInsuranceFilter(event.target.value);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option value="">Todos os convênios</option>
            {insuranceProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
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
                <th className="px-3 py-3 text-left font-medium">Paciente / serviço</th>
                <th className="px-3 py-3 text-left font-medium">Origem</th>
                <th className="px-3 py-3 text-right font-medium">Total</th>
                <th className="px-3 py-3 text-right font-medium">Recebido</th>
                <th className="px-3 py-3 text-right font-medium">Saldo</th>
                <th className="px-3 py-3 text-left font-medium">Vencimento</th>
                <th className="px-3 py-3 text-left font-medium">Status</th>
                <th className="px-3 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80">
                  <td className="px-3 py-4">
                    <p className="font-medium text-slate-900">{item.patientName || 'Paciente não informado'}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {SERVICE_TYPE_META[item.serviceType] || item.serviceType}
                      {item.procedureDescription ? ` • ${item.procedureDescription}` : ''}
                    </p>
                    {item.guideNumber && <p className="mt-1 text-xs text-slate-400">Guia {item.guideNumber}</p>}
                  </td>
                  <td className="px-3 py-4 text-slate-600">
                    <p>{item.insuranceName || PAYMENT_TYPE_META[item.paymentType] || '-'}</p>
                  </td>
                  <td className="px-3 py-4 text-right text-slate-900">{formatCurrency(item.totalAmount)}</td>
                  <td className="px-3 py-4 text-right text-emerald-700">{formatCurrency(item.receivedAmount)}</td>
                  <td className="px-3 py-4 text-right font-medium text-slate-900">
                    {formatCurrency(item.balance)}
                    {item.glosaAmount > 0 && <p className="mt-1 text-xs text-orange-600">Glosa {formatCurrency(item.glosaAmount)}</p>}
                  </td>
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
                      {item.balance > 0 && item.status !== 'cancelled' && item.status !== 'received' && (
                        <button
                          onClick={() => openReceive(item.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-2 text-white hover:bg-emerald-700"
                        >
                          <BadgeCent size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm text-slate-500">
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Detalhe do recebível</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{selectedItem.patientName || 'Paciente não informado'}</h3>
                <p className="mt-2 text-sm text-slate-500">{selectedItem.insuranceName || PAYMENT_TYPE_META[selectedItem.paymentType] || 'Origem não informada'}</p>
              </div>
              <button onClick={() => setDetailOpen(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
                Fechar
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <MetricTile label="Total" value={formatCurrency(selectedItem.totalAmount)} />
              <MetricTile label="Recebido" value={formatCurrency(selectedItem.receivedAmount)} />
              <MetricTile label="Saldo" value={formatCurrency(selectedItem.balance)} />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <DetailField label="Serviço" value={selectedItem.procedureDescription || SERVICE_TYPE_META[selectedItem.serviceType] || selectedItem.serviceType} />
              <DetailField label="Guia" value={selectedItem.guideNumber} />
              <DetailField label="Vencimento" value={formatDate(selectedItem.dueDate)} />
              <DetailField label="Status" value={STATUS_META[selectedItem.status]?.label || selectedItem.status} />
            </div>

            {selectedItem.payments?.length > 0 && (
              <div className="mt-6 rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Histórico de recebimentos</p>
                <div className="mt-3 space-y-2">
                  {selectedItem.payments.map((payment: any) => (
                    <div key={payment.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-3 text-sm">
                      <span className="text-slate-600">{payment.paymentMethod || 'Método não informado'}</span>
                      <span className="font-medium text-slate-900">{formatCurrency(payment.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {receiveOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Registrar baixa</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{selectedItem.patientName || 'Recebível'}</h3>
              </div>
              <button onClick={() => setReceiveOpen(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
                Fechar
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Saldo aberto</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(selectedItem.balance)}</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Valor recebido</label>
                <input
                  value={receiveAmount}
                  onChange={(event) => setReceiveAmount(event.target.value)}
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700 outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Método</label>
                <select
                  value={receiveMethod}
                  onChange={(event) => setReceiveMethod(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700 outline-none"
                >
                  <option value="transfer">Transferência</option>
                  <option value="pix">PIX</option>
                  <option value="cash">Dinheiro</option>
                  <option value="credit_card">Cartão</option>
                  <option value="insurance_transfer">Repasse convênio</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleReceive}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <BadgeCent size={16} />
                Confirmar baixa
              </button>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Novo recebível</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Adicionar conta a receber</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Registre o título já com contexto clínico e financeiro para aging, baixa e acompanhamento.
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
              <Field label="Paciente">
                <select value={createForm.patientId} onChange={(event) => setCreateForm((current) => ({ ...current, patientId: event.target.value }))} className={INPUT_CLASS}>
                  <option value="">Opcional</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>{patient.name || patient.phone}</option>
                  ))}
                </select>
              </Field>
              <Field label="Médico">
                <select value={createForm.doctorId} onChange={(event) => setCreateForm((current) => ({ ...current, doctorId: event.target.value }))} className={INPUT_CLASS}>
                  <option value="">Opcional</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tipo de cobrança">
                <select value={createForm.paymentType} onChange={(event) => setCreateForm((current) => ({ ...current, paymentType: event.target.value }))} className={INPUT_CLASS}>
                  <option value="particular">Particular</option>
                  <option value="insurance">Convênio</option>
                  <option value="sus">SUS</option>
                </select>
              </Field>
              <Field label="Convênio">
                <select value={createForm.insuranceProviderId} onChange={(event) => setCreateForm((current) => ({ ...current, insuranceProviderId: event.target.value }))} disabled={createForm.paymentType !== 'insurance'} className={INPUT_CLASS}>
                  <option value="">Selecionar</option>
                  {insuranceProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Centro de custo">
                <select value={createForm.costCenterId} onChange={(event) => setCreateForm((current) => ({ ...current, costCenterId: event.target.value }))} className={INPUT_CLASS}>
                  <option value="">Selecionar</option>
                  {costCenters.map((center) => (
                    <option key={center.id} value={center.id}>{center.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tipo de serviço">
                <select value={createForm.serviceType} onChange={(event) => setCreateForm((current) => ({ ...current, serviceType: event.target.value }))} className={INPUT_CLASS}>
                  <option value="consultation">Consulta</option>
                  <option value="exam">Exame</option>
                  <option value="procedure">Procedimento</option>
                  <option value="surgery">Cirurgia</option>
                  <option value="hospitalization">Internação</option>
                  <option value="other">Outro</option>
                </select>
              </Field>
              <Field label="Descrição">
                <input value={createForm.procedureDescription} onChange={(event) => setCreateForm((current) => ({ ...current, procedureDescription: event.target.value }))} className={INPUT_CLASS} />
              </Field>
              <Field label="Código do procedimento">
                <input value={createForm.procedureCode} onChange={(event) => setCreateForm((current) => ({ ...current, procedureCode: event.target.value }))} className={INPUT_CLASS} />
              </Field>
              <Field label="Guia">
                <input value={createForm.guideNumber} onChange={(event) => setCreateForm((current) => ({ ...current, guideNumber: event.target.value }))} className={INPUT_CLASS} />
              </Field>
              <Field label="Autorização">
                <input value={createForm.authorizationNumber} onChange={(event) => setCreateForm((current) => ({ ...current, authorizationNumber: event.target.value }))} className={INPUT_CLASS} />
              </Field>
              <Field label="Valor total (R$)">
                <input type="number" min="0" step="0.01" value={createForm.totalAmount} onChange={(event) => setCreateForm((current) => ({ ...current, totalAmount: event.target.value }))} className={INPUT_CLASS} />
              </Field>
              <Field label="Parcelas">
                <input type="number" min="1" step="1" value={createForm.installments} onChange={(event) => setCreateForm((current) => ({ ...current, installments: event.target.value }))} className={INPUT_CLASS} />
              </Field>
              <Field label="Data do serviço">
                <input type="date" value={createForm.serviceDate} onChange={(event) => setCreateForm((current) => ({ ...current, serviceDate: event.target.value }))} className={INPUT_CLASS} />
              </Field>
              <Field label="Vencimento">
                <input type="date" value={createForm.dueDate} onChange={(event) => setCreateForm((current) => ({ ...current, dueDate: event.target.value }))} className={INPUT_CLASS} />
              </Field>
              <Field label="Observações">
                <textarea value={createForm.notes} onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))} rows={4} className={INPUT_CLASS} />
              </Field>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={handleCreateReceivable} disabled={createSaving} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                <Plus size={16} />
                {createSaving ? 'Salvando...' : 'Criar recebível'}
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

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
