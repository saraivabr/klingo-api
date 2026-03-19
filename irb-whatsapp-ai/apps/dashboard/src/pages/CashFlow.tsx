import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Landmark,
  LineChart,
  RefreshCw,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { api } from '../services/api';

interface DashboardSummary {
  bankBalance: number;
  receivables: {
    openCents: number;
    overdueCents: number;
    receivedThisMonthCents: number;
  };
  payables: {
    openCents: number;
    overdueCents: number;
    paidThisMonthCents: number;
    pendingApprovalCents: number;
  };
  netPosition: number;
}

interface DailyPosition {
  date: string;
  openingBalance: number;
  credits: number;
  debits: number;
  closingBalance: number;
  creditsByCategory: Record<string, number>;
  debitsByCategory: Record<string, number>;
}

interface MonthlyFlow {
  year: number;
  month: number;
  totalCredits: number;
  creditCount: number;
  totalDebits: number;
  debitCount: number;
  netFlow: number;
  dailyCredits: Array<{ date: string; amount: number }>;
  dailyDebits: Array<{ date: string; amount: number }>;
}

interface ProjectionResponse {
  currentBalance: number;
  projection: Array<{ date: string; credits: number; debits: number; balance: number }>;
  summary: {
    totalProjectedCredits: number;
    totalProjectedDebits: number;
    minBalance: number;
    minBalanceDate?: string;
    endBalance: number;
  };
}

interface BankPosition {
  date: string;
  totalBalance: number;
  totalOverdraft: number;
  availableCredit: number;
  accounts: Array<{
    id: string;
    bankName: string;
    nickname: string;
    accountNumber: string;
    accountType: string;
    currentBalance: number;
    overdraftLimit: number;
    todayCredits: number;
    todayDebits: number;
  }>;
}

interface SnapshotRow {
  id: string;
  snapshotDate: string;
  costCenterName: string | null;
  openingBalance: number;
  totalCredits: number;
  totalDebits: number;
  closingBalance: number;
  isProjected: boolean;
}

interface DREData {
  period: { year: number; month: number };
  revenue: {
    items: Array<{ category: string; amount: number }>;
    total: number;
  };
  expenses: {
    items: Array<{ code: string | null; category: string | null; amount: number }>;
    total: number;
  };
  taxRetentions: {
    total: number;
  };
  operatingResult: number;
  netResult: number;
}

interface CostCenter {
  id: string;
  name: string;
}

interface BankAccountOption {
  id: string;
  bankName: string;
  nickname: string;
  accountNumber: string;
}

interface StatementImportRow {
  date: string;
  description: string;
  amount: number;
  balance?: number | null;
  type?: 'credit' | 'debit' | null;
  reference?: string | null;
}

interface StatementPreview {
  bankAccount: {
    id: string;
    nickname: string;
    bankName: string;
    accountNumber: string;
  };
  summary: {
    totalRows: number;
    duplicates: number;
    matchedPayables: number;
    matchedReceivables: number;
    credits: number;
    debits: number;
  };
  rows: Array<{
    index: number;
    date: string;
    description: string;
    amount: number;
    balance: number | null;
    type: 'credit' | 'debit';
    categorySuggestion: string;
    aiConfidence: number;
    duplicate: boolean;
    match: {
      kind: 'payable' | 'receivable' | 'none';
      confidence: number;
      autoAction: 'mark_paid' | 'register_receipt' | 'record_only';
      label: string | null;
      reason: string;
    };
  }>;
  applied?: {
    imported: number;
    payablesUpdated: number;
    receivablesUpdated: number;
    bankBalanceUpdated: boolean;
  };
}

type CashTab = 'daily' | 'monthly' | 'projection' | 'dre' | 'banks';

const MONTH_NAMES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function formatCurrency(cents: number) {
  const sign = cents < 0 ? '-' : '';
  return `${sign}R$ ${Math.abs(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

function tone(value: number) {
  if (value > 0) return 'text-emerald-600';
  if (value < 0) return 'text-rose-600';
  return 'text-slate-900';
}

function detectDelimiter(input: string) {
  const firstLine = input.split(/\r?\n/).find((line) => line.trim()) || '';
  const candidates = [';', ',', '\t'];
  return candidates.sort((left, right) => firstLine.split(right).length - firstLine.split(left).length)[0];
}

function parseAmount(raw: string) {
  const text = raw.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const numeric = Number(text.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

function parseDateInput(raw: string) {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function parseStatementCsv(input: string): StatementImportRow[] {
  const delimiter = detectDelimiter(input);
  const lines = input.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(delimiter).map((item) => item.trim().toLowerCase());
  const findIndex = (patterns: string[]) => headers.findIndex((header) => patterns.some((pattern) => header.includes(pattern)));

  const dateIndex = findIndex(['data', 'date']);
  const descriptionIndex = findIndex(['historico', 'descri', 'lançamento', 'lancamento', 'memo']);
  const amountIndex = findIndex(['valor', 'amount']);
  const creditIndex = findIndex(['credito', 'crédito', 'entrada']);
  const debitIndex = findIndex(['debito', 'débito', 'saida', 'saída']);
  const balanceIndex = findIndex(['saldo', 'balance']);
  const referenceIndex = findIndex(['documento', 'referencia', 'ref']);

  return lines.slice(1).map((line) => {
    const cols = line.split(delimiter).map((item) => item.trim());
    const rawCredit = creditIndex >= 0 ? parseAmount(cols[creditIndex] || '') : 0;
    const rawDebit = debitIndex >= 0 ? parseAmount(cols[debitIndex] || '') : 0;
    const signedAmount = rawCredit ? rawCredit : rawDebit ? rawDebit : parseAmount(cols[amountIndex] || '');
    const explicitType: 'credit' | 'debit' = rawCredit ? 'credit' : rawDebit ? 'debit' : signedAmount < 0 ? 'debit' : 'credit';

    return {
      date: parseDateInput(cols[dateIndex] || ''),
      description: cols[descriptionIndex] || cols[referenceIndex] || 'Sem descrição',
      amount: Math.abs(signedAmount),
      balance: balanceIndex >= 0 ? parseAmount(cols[balanceIndex] || '') : null,
      type: explicitType,
      reference: referenceIndex >= 0 ? cols[referenceIndex] || null : null,
    };
  }).filter((row) => row.date && row.description && row.amount > 0);
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

function MoneyStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={`mt-3 text-2xl font-semibold tracking-tight ${accent || tone(value)}`}>{formatCurrency(value)}</p>
    </div>
  );
}

export default function CashFlow() {
  const [activeTab, setActiveTab] = useState<CashTab>('daily');
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [projectionDays, setProjectionDays] = useState(30);
  const [selectedCostCenter, setSelectedCostCenter] = useState('');
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [statementBankId, setStatementBankId] = useState('');
  const [statementFileName, setStatementFileName] = useState('');
  const [statementRows, setStatementRows] = useState<StatementImportRow[]>([]);
  const [statementPreview, setStatementPreview] = useState<StatementPreview | null>(null);
  const [statementBusy, setStatementBusy] = useState(false);
  const [statementMessage, setStatementMessage] = useState<string | null>(null);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [dailyPosition, setDailyPosition] = useState<DailyPosition | null>(null);
  const [monthlyFlow, setMonthlyFlow] = useState<MonthlyFlow | null>(null);
  const [projection, setProjection] = useState<ProjectionResponse | null>(null);
  const [dre, setDre] = useState<DREData | null>(null);
  const [bankPosition, setBankPosition] = useState<BankPosition | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);

  useEffect(() => {
    Promise.all([api.getCashFlowSummary(), api.getCostCenters(), api.getBankAccounts()]).then(([dashboardSummary, centers, accounts]) => {
      setSummary(dashboardSummary);
      setCostCenters(centers.items);
      setBankAccounts(accounts.items);
      if (!statementBankId && accounts.items[0]?.id) {
        setStatementBankId(accounts.items[0].id);
      }
    });
  }, []);

  useEffect(() => {
    api
      .getCashFlowSnapshots({ costCenterId: selectedCostCenter || undefined })
      .then((response) => {
        setSnapshots(response.snapshots);

        const latest = response.snapshots?.[0];
        if (!latest) return;

        const today = new Date().toISOString().slice(0, 10);
        if (selectedDate > latest.snapshotDate && activeTab === 'daily') {
          setSelectedDate(latest.snapshotDate);
        }

        if (activeTab === 'monthly') {
          const [year, month] = latest.snapshotDate.split('-').map(Number);
          const currentMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
          const latestMonthKey = `${year}-${String(month).padStart(2, '0')}`;
          if (currentMonthKey > latestMonthKey || today > latest.snapshotDate) {
            setSelectedYear(year);
            setSelectedMonth(month);
          }
        }
      })
      .catch(() => setSnapshots([]));
  }, [activeTab, selectedCostCenter]);

  useEffect(() => {
    setLoading(true);

    const request =
      activeTab === 'daily'
        ? api.getDailyCashFlow(selectedDate, selectedCostCenter || undefined).then(setDailyPosition)
        : activeTab === 'monthly'
          ? api.getMonthlyCashFlow(selectedYear, selectedMonth, selectedCostCenter || undefined).then(setMonthlyFlow)
          : activeTab === 'projection'
            ? api.getCashFlowProjection(projectionDays, selectedCostCenter || undefined).then(setProjection)
            : activeTab === 'dre'
              ? api.getDRE(selectedYear, selectedMonth).then(setDre)
              : api.getBankPosition(selectedDate).then(setBankPosition);

    request.finally(() => setLoading(false));
  }, [activeTab, projectionDays, selectedCostCenter, selectedDate, selectedMonth, selectedYear]);

  const topCreditCategories = useMemo(
    () => Object.entries(dailyPosition?.creditsByCategory || {}).sort((a, b) => b[1] - a[1]).slice(0, 6),
    [dailyPosition],
  );
  const topDebitCategories = useMemo(
    () => Object.entries(dailyPosition?.debitsByCategory || {}).sort((a, b) => b[1] - a[1]).slice(0, 6),
    [dailyPosition],
  );
  const topExpenses = useMemo(
    () => [...(dre?.expenses.items || [])].sort((a, b) => b.amount - a.amount).slice(0, 8),
    [dre],
  );
  const recentSnapshots = useMemo(() => snapshots.slice(0, 8), [snapshots]);
  const latestSnapshot = recentSnapshots[0];
  const hasDailyMovement = Boolean(dailyPosition && (dailyPosition.credits > 0 || dailyPosition.debits > 0));
  const hasMonthlyMovement = Boolean(monthlyFlow && (monthlyFlow.creditCount > 0 || monthlyFlow.debitCount > 0));

  const refresh = async () => {
    const dashboardSummary = await api.getCashFlowSummary();
    setSummary(dashboardSummary);

    if (activeTab === 'daily') {
      setDailyPosition(await api.getDailyCashFlow(selectedDate, selectedCostCenter || undefined));
    } else if (activeTab === 'monthly') {
      setMonthlyFlow(await api.getMonthlyCashFlow(selectedYear, selectedMonth, selectedCostCenter || undefined));
    } else if (activeTab === 'projection') {
      setProjection(await api.getCashFlowProjection(projectionDays, selectedCostCenter || undefined));
    } else if (activeTab === 'dre') {
      setDre(await api.getDRE(selectedYear, selectedMonth));
    } else {
      setBankPosition(await api.getBankPosition(selectedDate));
    }
  };

  const handleStatementFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const parsedRows = parseStatementCsv(text);
    setStatementFileName(file.name);
    setStatementRows(parsedRows);
    setStatementPreview(null);
    setStatementMessage(parsedRows.length ? `${parsedRows.length} linhas prontas para análise.` : 'Não consegui ler linhas válidas desse arquivo.');
  };

  const previewStatementImport = async () => {
    if (!statementBankId || !statementRows.length || !statementFileName) return;
    setStatementBusy(true);
    setStatementMessage(null);
    try {
      const preview = await api.previewStatementImport({
        bankAccountId: statementBankId,
        fileName: statementFileName,
        rows: statementRows,
      });
      setStatementPreview(preview);
      setStatementMessage('Prévia gerada com matching assistido por IA.');
    } finally {
      setStatementBusy(false);
    }
  };

  const applyStatementImport = async () => {
    if (!statementBankId || !statementRows.length || !statementFileName) return;
    setStatementBusy(true);
    setStatementMessage(null);
    try {
      const result = await api.applyStatementImport({
        bankAccountId: statementBankId,
        fileName: statementFileName,
        rows: statementRows,
      });
      setStatementPreview(result);
      setStatementMessage('Extrato aplicado no financeiro.');
      await refresh();
      setBankPosition(await api.getBankPosition(selectedDate));
    } finally {
      setStatementBusy(false);
    }
  };

  const tabs: Array<{ id: CashTab; label: string }> = [
    { id: 'daily', label: 'Leitura diária' },
    { id: 'monthly', label: 'Mensal' },
    { id: 'projection', label: 'Projeção' },
    { id: 'dre', label: 'DRE' },
    { id: 'banks', label: 'Bancos' },
  ];

  return (
    <div className="space-y-6 px-6 py-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-900 bg-slate-950 text-white shadow-2xl shadow-slate-950/15">
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.4fr_0.9fr] lg:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">Fluxo de Caixa</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">Caixa com contexto. Não só saldo, mas pressão, folga e tendência.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              A leitura agora separa posição bancária, recebíveis, pagamentos em pressão e projeção. O objetivo é responder rápido se o caixa aguenta a operação e onde ele sangra.
            </p>
          </div>

          <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <span className="text-sm text-slate-300">Saldo bancário</span>
              <span className={`text-xl font-semibold ${tone(summary?.bankBalance || 0)}`}>{formatCurrency(summary?.bankBalance || 0)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <span className="text-sm text-slate-300">A pagar em aberto</span>
              <span className="text-xl font-semibold text-amber-300">{formatCurrency(summary?.payables.openCents || 0)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <span className="text-sm text-slate-300">A receber em aberto</span>
              <span className="text-xl font-semibold text-cyan-300">{formatCurrency(summary?.receivables.openCents || 0)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MoneyStat label="Posição líquida" value={summary?.netPosition || 0} />
        <MoneyStat label="Recebíveis vencidos" value={summary?.receivables.overdueCents || 0} accent="text-rose-600" />
        <MoneyStat label="Pagamentos vencidos" value={summary?.payables.overdueCents || 0} accent="text-amber-600" />
        <MoneyStat label="Aguardando aprovação" value={summary?.payables.pendingApprovalCents || 0} accent="text-violet-600" />
      </section>

      {!hasDailyMovement && recentSnapshots.length > 0 && (
        <Surface
          title="Histórico salvo de caixa"
          subtitle="Ainda faltam baixas e recebimentos operacionais nesta base. Enquanto isso, a tela puxa os snapshots já importados."
        >
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
              <MoneyStat label="Último snapshot" value={latestSnapshot?.closingBalance || 0} />
              <MoneyStat label="Entradas no snapshot" value={latestSnapshot?.totalCredits || 0} accent="text-emerald-600" />
              <MoneyStat label="Saídas no snapshot" value={latestSnapshot?.totalDebits || 0} accent="text-rose-600" />
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium">Data</th>
                    <th className="px-3 py-3 text-right font-medium">Entradas</th>
                    <th className="px-3 py-3 text-right font-medium">Saídas</th>
                    <th className="px-3 py-3 text-right font-medium">Saldo final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentSnapshots.map((snapshot) => (
                    <tr key={snapshot.id}>
                      <td className="px-3 py-4 text-slate-700">{formatDate(snapshot.snapshotDate)}</td>
                      <td className="px-3 py-4 text-right text-emerald-700">{formatCurrency(snapshot.totalCredits)}</td>
                      <td className="px-3 py-4 text-right text-rose-700">{formatCurrency(snapshot.totalDebits)}</td>
                      <td className={`px-3 py-4 text-right font-medium ${tone(snapshot.closingBalance)}`}>{formatCurrency(snapshot.closingBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Surface>
      )}

      <Surface
        title="Central de extratos"
        subtitle="Importe CSV do banco, deixe a IA sugerir o vínculo e aplique as baixas no financeiro."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
              <FileUp size={16} />
              Ler arquivo
              <input type="file" accept=".csv,.txt" onChange={handleStatementFile} className="hidden" />
            </label>
            <button
              onClick={previewStatementImport}
              disabled={!statementRows.length || !statementBankId || statementBusy}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles size={16} />
              Analisar com IA
            </button>
            <button
              onClick={applyStatementImport}
              disabled={!statementPreview || statementBusy}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 hover:bg-emerald-700"
            >
              Aplicar no financeiro
            </button>
          </div>
        }
      >
        <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Conta de destino</p>
              <select
                value={statementBankId}
                onChange={(event) => setStatementBankId(event.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none"
              >
                <option value="">Selecione uma conta bancária</option>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.bankName} • {account.nickname} • {account.accountNumber}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Arquivo</p>
              <p className="mt-3 text-sm text-slate-700">{statementFileName || 'Nenhum arquivo selecionado.'}</p>
              <p className="mt-2 text-xs text-slate-500">CSV/TXT exportado pelo banco. O navegador lê o arquivo e envia as linhas já normalizadas.</p>
            </div>

            {statementMessage && (
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-800">
                {statementMessage}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Linhas</p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{statementPreview?.summary.totalRows || statementRows.length}</p>
              </div>
              <MoneyStat label="Entradas" value={statementPreview?.summary.credits || 0} accent="text-emerald-600" />
              <MoneyStat label="Saídas" value={statementPreview?.summary.debits || 0} accent="text-rose-600" />
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Duplicadas</p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-amber-600">{statementPreview?.summary.duplicates || 0}</p>
              </div>
            </div>

            {statementPreview ? (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Matches em pagar</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{statementPreview.summary.matchedPayables}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Matches em receber</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{statementPreview.summary.matchedReceivables}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ação sugerida</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">A IA marca baixa onde a confiança permite e grava o resto como transação para revisão.</p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-3 py-3 text-left font-medium">Data</th>
                        <th className="px-3 py-3 text-left font-medium">Descrição</th>
                        <th className="px-3 py-3 text-left font-medium">Sugestão IA</th>
                        <th className="px-3 py-3 text-left font-medium">Match</th>
                        <th className="px-3 py-3 text-right font-medium">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {statementPreview.rows.slice(0, 12).map((row) => (
                        <tr key={`${row.date}-${row.index}`} className="hover:bg-slate-50/80">
                          <td className="px-3 py-4 text-slate-600">{formatDate(row.date)}</td>
                          <td className="px-3 py-4">
                            <p className="font-medium text-slate-900">{row.description}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {row.type === 'credit' ? 'Entrada' : 'Saída'}
                              {row.duplicate ? ' • Já importada' : ''}
                            </p>
                          </td>
                          <td className="px-3 py-4">
                            <p className="font-medium text-slate-900">{row.categorySuggestion || 'Sem categoria'}</p>
                            <p className="mt-1 text-xs text-slate-500">Confiança {(row.aiConfidence * 100).toFixed(0)}%</p>
                          </td>
                          <td className="px-3 py-4">
                            <p className="font-medium text-slate-900">{row.match.label || 'Sem vínculo automático'}</p>
                            <p className="mt-1 text-xs text-slate-500">{row.match.reason}</p>
                          </td>
                          <td className={`px-3 py-4 text-right font-medium ${row.type === 'credit' ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {formatCurrency(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {statementPreview.applied && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    {statementPreview.applied.imported} transações importadas, {statementPreview.applied.payablesUpdated} contas a pagar baixadas, {statementPreview.applied.receivablesUpdated} recebíveis atualizados.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-sm text-slate-500">
                Selecione uma conta, envie o CSV do banco e gere a prévia para a IA sugerir conciliação e atualização do financeiro.
              </div>
            )}
          </div>
        </div>
      </Surface>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-slate-950 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <select
            value={selectedCostCenter}
            onChange={(event) => setSelectedCostCenter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-0"
          >
            <option value="">Todos os centros de custo</option>
            {costCenters.map((center) => (
              <option key={center.id} value={center.id}>
                {center.name}
              </option>
            ))}
          </select>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 transition-colors hover:text-slate-900"
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-10 text-sm text-slate-500 shadow-sm shadow-slate-200/60">
          Carregando análise de caixa...
        </div>
      ) : (
        <>
          {activeTab === 'daily' && dailyPosition && (
            <div className="space-y-6">
              <Surface
                title="Leitura diária"
                subtitle="Saldo de abertura, movimento do dia e composição por categoria."
                action={
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedDate(new Date(new Date(selectedDate).setDate(new Date(selectedDate).getDate() - 1)).toISOString().slice(0, 10))} className="rounded-xl border border-slate-200 p-2 text-slate-500">
                      <ChevronLeft size={16} />
                    </button>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(event) => setSelectedDate(event.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                    />
                    <button onClick={() => setSelectedDate(new Date(new Date(selectedDate).setDate(new Date(selectedDate).getDate() + 1)).toISOString().slice(0, 10))} className="rounded-xl border border-slate-200 p-2 text-slate-500">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                }
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <MoneyStat label="Saldo inicial" value={dailyPosition.openingBalance} />
                  <MoneyStat label="Entradas" value={dailyPosition.credits} accent="text-emerald-600" />
                  <MoneyStat label="Saídas" value={dailyPosition.debits} accent="text-rose-600" />
                  <MoneyStat label="Saldo final" value={dailyPosition.closingBalance} accent={tone(dailyPosition.closingBalance)} />
                </div>
              </Surface>

              <div className="grid gap-6 xl:grid-cols-2">
                <Surface title="Entradas por categoria" subtitle={`Base de ${formatDate(dailyPosition.date)}`}>
                  {topCreditCategories.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Sem entradas classificadas para este dia.
                      {!hasDailyMovement && latestSnapshot ? ` Último snapshot disponível em ${formatDate(latestSnapshot.snapshotDate)}.` : ''}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {topCreditCategories.map(([label, amount]) => (
                        <div key={label} className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                          <span className="text-sm font-medium text-emerald-900">{label}</span>
                          <span className="text-sm font-semibold text-emerald-700">{formatCurrency(amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Surface>

                <Surface title="Saídas por categoria" subtitle={`Base de ${formatDate(dailyPosition.date)}`}>
                  {topDebitCategories.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Sem saídas classificadas para este dia.
                      {!hasDailyMovement && latestSnapshot ? ` Use a Central de extratos para alimentar o dia.` : ''}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {topDebitCategories.map(([label, amount]) => (
                        <div key={label} className="flex items-center justify-between rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3">
                          <span className="text-sm font-medium text-rose-900">{label}</span>
                          <span className="text-sm font-semibold text-rose-700">{formatCurrency(amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Surface>
              </div>
            </div>
          )}

          {activeTab === 'monthly' && monthlyFlow && (
            <div className="space-y-6">
              <Surface
                title="Fechamento mensal"
                subtitle="Volume recebido, volume pago e variação líquida do mês."
                action={
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (selectedMonth === 1) {
                          setSelectedMonth(12);
                          setSelectedYear((value) => value - 1);
                        } else {
                          setSelectedMonth((value) => value - 1);
                        }
                      }}
                      className="rounded-xl border border-slate-200 p-2 text-slate-500"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                      {MONTH_NAMES[selectedMonth]} {selectedYear}
                    </div>
                    <button
                      onClick={() => {
                        if (selectedMonth === 12) {
                          setSelectedMonth(1);
                          setSelectedYear((value) => value + 1);
                        } else {
                          setSelectedMonth((value) => value + 1);
                        }
                      }}
                      className="rounded-xl border border-slate-200 p-2 text-slate-500"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                }
              >
                <div className="grid gap-4 md:grid-cols-3">
                  <MoneyStat label="Entradas no mês" value={monthlyFlow.totalCredits} accent="text-emerald-600" />
                  <MoneyStat label="Saídas no mês" value={monthlyFlow.totalDebits} accent="text-rose-600" />
                  <MoneyStat label="Fluxo líquido" value={monthlyFlow.netFlow} />
                </div>
              </Surface>

              <div className="grid gap-6 xl:grid-cols-2">
                <Surface title="Calendário de entradas" subtitle={`${monthlyFlow.creditCount} lançamentos recebidos`}>
                  <div className="space-y-3">
                    {monthlyFlow.dailyCredits.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Sem entradas registradas no período.
                        {!hasMonthlyMovement && latestSnapshot ? ` Há snapshots históricos até ${formatDate(latestSnapshot.snapshotDate)}.` : ''}
                      </p>
                    ) : (
                      monthlyFlow.dailyCredits.map((item) => (
                        <div key={item.date} className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                          <span className="text-sm font-medium text-emerald-900">{formatDate(item.date)}</span>
                          <span className="text-sm font-semibold text-emerald-700">{formatCurrency(item.amount)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </Surface>

                <Surface title="Calendário de saídas" subtitle={`${monthlyFlow.debitCount} pagamentos baixados`}>
                  <div className="space-y-3">
                    {monthlyFlow.dailyDebits.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Sem saídas registradas no período.
                        {!hasMonthlyMovement ? ' O mês ainda não foi alimentado por baixas e extratos.' : ''}
                      </p>
                    ) : (
                      monthlyFlow.dailyDebits.map((item) => (
                        <div key={item.date} className="flex items-center justify-between rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3">
                          <span className="text-sm font-medium text-rose-900">{formatDate(item.date)}</span>
                          <span className="text-sm font-semibold text-rose-700">{formatCurrency(item.amount)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </Surface>
              </div>
            </div>
          )}

          {activeTab === 'projection' && projection && (
            <div className="space-y-6">
              <Surface
                title="Projeção de caixa"
                subtitle="Quando o saldo aperta e quanto o horizonte consome."
                action={
                  <select
                    value={projectionDays}
                    onChange={(event) => setProjectionDays(Number(event.target.value))}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <option value={15}>15 dias</option>
                    <option value={30}>30 dias</option>
                    <option value={60}>60 dias</option>
                    <option value={90}>90 dias</option>
                  </select>
                }
              >
                <div className="grid gap-4 md:grid-cols-4">
                  <MoneyStat label="Saldo atual" value={projection.currentBalance} />
                  <MoneyStat label="Créditos projetados" value={projection.summary.totalProjectedCredits} accent="text-emerald-600" />
                  <MoneyStat label="Débitos projetados" value={projection.summary.totalProjectedDebits} accent="text-rose-600" />
                  <MoneyStat label="Saldo no fim" value={projection.summary.endBalance} />
                </div>
              </Surface>

              <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
                <Surface title="Linha de projeção" subtitle="Créditos, débitos e saldo acumulado por data.">
                  <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
                    {projection.projection.map((entry) => (
                      <div key={entry.date} className="grid grid-cols-[1fr_1fr_1fr_1fr] items-center rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                        <span className="font-medium text-slate-900">{formatDate(entry.date)}</span>
                        <span className="text-emerald-600">{formatCurrency(entry.credits)}</span>
                        <span className="text-rose-600">{formatCurrency(entry.debits)}</span>
                        <span className={`text-right font-semibold ${tone(entry.balance)}`}>{formatCurrency(entry.balance)}</span>
                      </div>
                    ))}
                  </div>
                </Surface>

                <Surface title="Ponto crítico" subtitle="Menor saldo encontrado na curva.">
                  <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
                    <div className="flex items-center gap-3 text-amber-700">
                      <LineChart size={18} />
                      <span className="text-sm font-medium">Mínimo da projeção</span>
                    </div>
                    <p className={`mt-4 text-3xl font-semibold ${tone(projection.summary.minBalance)}`}>{formatCurrency(projection.summary.minBalance)}</p>
                    <p className="mt-2 text-sm text-amber-800">
                      {projection.summary.minBalanceDate ? `Data crítica: ${formatDate(projection.summary.minBalanceDate)}.` : 'Sem data crítica calculada.'}
                    </p>
                  </div>
                </Surface>
              </div>
            </div>
          )}

          {activeTab === 'dre' && dre && (
            <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
              <Surface title="Resumo do DRE" subtitle={`${MONTH_NAMES[dre.period.month]} ${dre.period.year}`}>
                <div className="space-y-3">
                  <MoneyStat label="Receita" value={dre.revenue.total} accent="text-emerald-600" />
                  <MoneyStat label="Despesas" value={dre.expenses.total} accent="text-rose-600" />
                  <MoneyStat label="Retenções" value={dre.taxRetentions.total} accent="text-amber-600" />
                  <MoneyStat label="Resultado líquido" value={dre.netResult} />
                </div>
              </Surface>

              <Surface title="Maior impacto em despesa" subtitle="Categorias ordenadas por peso financeiro.">
                <div className="space-y-3">
                  {topExpenses.length === 0 ? (
                    <p className="text-sm text-slate-500">Sem despesas baixadas para o período.</p>
                  ) : (
                    topExpenses.map((expense) => (
                      <div key={`${expense.code}-${expense.category}`} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{expense.category || 'Categoria sem nome'}</p>
                          <p className="text-xs text-slate-500">{expense.code || 'Sem código'}</p>
                        </div>
                        <span className="font-semibold text-slate-900">{formatCurrency(expense.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </Surface>
            </div>
          )}

          {activeTab === 'banks' && bankPosition && (
            <div className="space-y-6">
              <Surface title="Posição bancária consolidada" subtitle={`Base em ${formatDate(bankPosition.date)}`}>
                <div className="grid gap-4 md:grid-cols-3">
                  <MoneyStat label="Saldo consolidado" value={bankPosition.totalBalance} />
                  <MoneyStat label="Cheque especial" value={bankPosition.totalOverdraft} accent="text-violet-600" />
                  <MoneyStat label="Liquidez disponível" value={bankPosition.availableCredit} accent="text-cyan-600" />
                </div>
              </Surface>

              <Surface title="Contas bancárias" subtitle="Saldo atual e movimento do dia por conta.">
                <div className="grid gap-4 xl:grid-cols-2">
                  {bankPosition.accounts.map((account) => (
                    <div key={account.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{account.nickname || account.bankName}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                            {account.bankName} • {account.accountNumber}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-500">
                          <Landmark size={16} />
                        </div>
                      </div>

                      <p className={`mt-5 text-2xl font-semibold ${tone(account.currentBalance)}`}>{formatCurrency(account.currentBalance)}</p>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-emerald-600">Entradas hoje</p>
                          <p className="mt-2 text-sm font-semibold text-emerald-700">{formatCurrency(account.todayCredits)}</p>
                        </div>
                        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-rose-600">Saídas hoje</p>
                          <p className="mt-2 text-sm font-semibold text-rose-700">{formatCurrency(account.todayDebits)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Surface>
            </div>
          )}
        </>
      )}
    </div>
  );
}
