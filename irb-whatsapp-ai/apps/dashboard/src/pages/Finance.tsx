import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BadgeDollarSign,
  Building2,
  ClipboardCheck,
  CreditCard,
  DollarSign,
  Layers3,
  ReceiptText,
  Users,
  WalletCards,
} from 'lucide-react';
import { api } from '../services/api';

interface FinanceSummary {
  activeSubscriptions: number;
  overdueSubscriptions: number;
  monthRevenueCents: number;
  overdueTotalCents: number;
}

interface CashFlowSummary {
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

interface Payment {
  id: string;
  status: string;
  billingType: string;
  amountCents: number;
  dueDate: string | null;
  paidAt: string | null;
  patientName: string | null;
  planName: string;
}

interface Plan {
  id: string;
  name: string;
  priceCents: number;
  subscriberCount: number;
  isActive: boolean;
}

const PAYMENT_STATUS_BADGES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-200',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  RECEIVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  OVERDUE: 'bg-rose-50 text-rose-700 ring-rose-200',
  REFUNDED: 'bg-slate-100 text-slate-600 ring-slate-200',
};

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

function ratio(part: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

function MetricCard({
  icon: Icon,
  eyebrow,
  value,
  tone,
  support,
}: {
  icon: any;
  eyebrow: string;
  value: string;
  tone: string;
  support: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-200/60">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
          <p className={`mt-3 text-3xl font-semibold tracking-tight ${tone}`}>{value}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-700">
          <Icon size={18} />
        </div>
      </div>
      <p className="text-sm leading-6 text-slate-500">{support}</p>
    </div>
  );
}

function ModuleLink({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-[24px] border border-slate-200 bg-white/90 p-5 shadow-sm shadow-slate-200/60 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-slate-900">{title}</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-700 transition group-hover:bg-slate-900 group-hover:text-white">
          <Icon size={18} />
        </div>
      </div>
    </Link>
  );
}

export default function Finance() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [cashSummary, setCashSummary] = useState<CashFlowSummary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getFinanceSummary(),
      api.getCashFlowSummary(),
      api.getPayments({ limit: '8' }),
      api.getPlans(),
    ])
      .then(([financeSummary, operationalSummary, paymentResponse, plansResponse]) => {
        setSummary(financeSummary);
        setCashSummary(operationalSummary);
        setPayments(paymentResponse.payments);
        setPlans(plansResponse.plans);
      })
      .finally(() => setLoading(false));
  }, []);

  const portfolio = useMemo(() => {
    const activePlans = plans.filter((plan) => plan.isActive);
    const totalSubscribers = activePlans.reduce((sum, plan) => sum + plan.subscriberCount, 0);
    const topPlan = [...activePlans].sort((a, b) => b.subscriberCount - a.subscriberCount)[0];
    return { activePlans, totalSubscribers, topPlan };
  }, [plans]);

  if (loading) {
    return <div className="px-6 py-6 text-sm text-slate-500">Carregando visão financeira...</div>;
  }

  return (
    <div className="space-y-6 px-6 py-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-900 bg-slate-950 text-white shadow-2xl shadow-slate-950/15">
        <div className="grid gap-8 px-6 py-6 lg:grid-cols-[1.35fr_0.9fr] lg:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">Centro Financeiro</p>
            <div className="mt-4 max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight">Operação financeira com leitura de caixa, cobrança e assinatura no mesmo painel.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                A visão antiga misturava assinatura com financeiro operacional. Aqui a leitura começa pela posição líquida, passa por pressão de caixa e termina em recorrência.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <span className="text-sm text-slate-300">Saldo bancário</span>
              <span className="text-xl font-semibold">{formatCurrency(cashSummary?.bankBalance || 0)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <span className="text-sm text-slate-300">Posição líquida</span>
              <span className={`text-xl font-semibold ${(cashSummary?.netPosition || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {formatCurrency(cashSummary?.netPosition || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <span className="text-sm text-slate-300">Receita recorrente do mês</span>
              <span className="text-xl font-semibold text-cyan-300">{formatCurrency(summary?.monthRevenueCents || 0)}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={BadgeDollarSign}
          eyebrow="Posição Líquida"
          value={formatCurrency(cashSummary?.netPosition || 0)}
          tone={(cashSummary?.netPosition || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}
          support={`${formatCurrency(cashSummary?.receivables.openCents || 0)} a receber versus ${formatCurrency(cashSummary?.payables.openCents || 0)} a pagar.`}
        />
        <MetricCard
          icon={ArrowUpCircle}
          eyebrow="Pipeline de Recebíveis"
          value={formatCurrency(cashSummary?.receivables.openCents || 0)}
          tone="text-sky-600"
          support={`${formatCurrency(cashSummary?.receivables.overdueCents || 0)} em atraso e ${formatCurrency(cashSummary?.receivables.receivedThisMonthCents || 0)} recebido no mês.`}
        />
        <MetricCard
          icon={ArrowDownCircle}
          eyebrow="Pressão de Pagamentos"
          value={formatCurrency(cashSummary?.payables.openCents || 0)}
          tone="text-amber-600"
          support={`${formatCurrency(cashSummary?.payables.pendingApprovalCents || 0)} aguardando aprovação e ${formatCurrency(cashSummary?.payables.overdueCents || 0)} pressionando vencimento.`}
        />
        <MetricCard
          icon={Users}
          eyebrow="Recorrência"
          value={`${summary?.activeSubscriptions || 0} ativos`}
          tone="text-violet-600"
          support={`${summary?.overdueSubscriptions || 0} inadimplentes e ${portfolio.activePlans.length} planos ativos no portfólio.`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Pagamentos recentes</h3>
              <p className="text-sm text-slate-500">Leitura rápida do que entrou na régua de assinatura.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{payments.length} itens</span>
          </div>

          {payments.length === 0 ? (
            <div className="px-5 py-10 text-sm text-slate-500">Nenhum pagamento registrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Paciente</th>
                    <th className="px-5 py-3 text-left font-medium">Plano</th>
                    <th className="px-5 py-3 text-left font-medium">Valor</th>
                    <th className="px-5 py-3 text-left font-medium">Status</th>
                    <th className="px-5 py-3 text-left font-medium">Vencimento</th>
                    <th className="px-5 py-3 text-left font-medium">Baixa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-4 font-medium text-slate-900">{payment.patientName || 'Paciente não vinculado'}</td>
                      <td className="px-5 py-4 text-slate-600">{payment.planName}</td>
                      <td className="px-5 py-4 font-medium text-slate-900">{formatCurrency(payment.amountCents)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${PAYMENT_STATUS_BADGES[payment.status] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(payment.dueDate)}</td>
                      <td className="px-5 py-4 text-slate-600">{formatDate(payment.paidAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Portfólio de planos</h3>
                <p className="text-sm text-slate-500">Participação de cada oferta ativa.</p>
              </div>
              <Layers3 className="text-slate-400" size={18} />
            </div>

            <div className="mt-5 space-y-4">
              {portfolio.activePlans.map((plan) => (
                <div key={plan.id}>
                  <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{plan.name}</p>
                      <p className="text-slate-500">{formatCurrency(plan.priceCents)} por ciclo</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{plan.subscriberCount}</p>
                      <p className="text-xs text-slate-500">assinantes</p>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-500"
                      style={{ width: `${ratio(plan.subscriberCount, portfolio.totalSubscribers)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Radar de atenção</h3>
                <p className="text-sm text-slate-500">O que exige ação financeira imediata.</p>
              </div>
              <ReceiptText className="text-slate-400" size={18} />
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                <div className="flex items-center gap-2 text-rose-700">
                  <AlertTriangle size={16} />
                  <span className="text-sm font-medium">Cobrança em atraso</span>
                </div>
                <p className="mt-2 text-2xl font-semibold text-rose-700">{formatCurrency(summary?.overdueTotalCents || 0)}</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <div className="flex items-center gap-2 text-amber-700">
                  <CreditCard size={16} />
                  <span className="text-sm font-medium">Aprovação pendente para pagar</span>
                </div>
                <p className="mt-2 text-2xl font-semibold text-amber-700">{formatCurrency(cashSummary?.payables.pendingApprovalCents || 0)}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="flex items-center gap-2 text-emerald-700">
                  <DollarSign size={16} />
                  <span className="text-sm font-medium">Recebido no mês</span>
                </div>
                <p className="mt-2 text-2xl font-semibold text-emerald-700">{formatCurrency(cashSummary?.receivables.receivedThisMonthCents || 0)}</p>
              </div>
            </div>

            {portfolio.topPlan && (
              <div className="mt-5 rounded-2xl bg-slate-950 px-4 py-4 text-slate-50">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Plano dominante</p>
                <p className="mt-2 text-lg font-semibold">{portfolio.topPlan.name}</p>
                <p className="mt-1 text-sm text-slate-300">{portfolio.topPlan.subscriberCount} assinantes no mix ativo.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ModuleLink
          to="/finance/payable"
          icon={ArrowDownCircle}
          title="Contas a Pagar"
          description="Fila operacional, vencidos, aprovações e baixa financeira."
        />
        <ModuleLink
          to="/finance/receivable"
          icon={ArrowUpCircle}
          title="Contas a Receber"
          description="Carteira, aging, glosas e entrada de recebimentos."
        />
        <ModuleLink
          to="/finance/daily"
          icon={ClipboardCheck}
          title="Pagamento Diário"
          description="Agenda do dia com prioridades, bancos e cartão corporativo."
        />
        <ModuleLink
          to="/finance/cashflow"
          icon={ReceiptText}
          title="Fluxo de Caixa"
          description="Realizado, histórico salvo, projeção e importação de extratos."
        />
        <ModuleLink
          to="/finance/reimbursements"
          icon={CreditCard}
          title="Reembolsos"
          description="Viagens, comprovantes e status de liberação."
        />
        <ModuleLink
          to="/finance/orders"
          icon={WalletCards}
          title="Ordens de Pagamento"
          description="Lotes operacionais de VT e execução por competência."
        />
        <ModuleLink
          to="/finance/cadastros"
          icon={Building2}
          title="Cadastros"
          description="Plano de contas, centros de custo, fornecedores e bancos."
        />
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 p-5">
          <p className="text-base font-semibold text-slate-900">Leitura real da base</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            O módulo agora segue a estrutura do `IRB Finance`, mas só exibe dados vindos da API e do banco real.
          </p>
        </div>
      </section>
    </div>
  );
}
