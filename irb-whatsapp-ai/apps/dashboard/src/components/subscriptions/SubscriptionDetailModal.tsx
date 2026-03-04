import React, { useEffect, useState } from 'react';
import {
  X, Loader2, CheckCircle2, AlertCircle, ExternalLink,
  CreditCard, QrCode, FileText, Shield, Crown, Gem,
  Calendar, Clock, StickyNote, RefreshCw, Pause, Play, XCircle,
  ChevronRight, Receipt, Zap, Ban,
} from 'lucide-react';
import { api } from '../../services/api';
import PatientDetailModal from './PatientDetailModal';

/* ── types ─────────────────────────────────── */

interface SubscriptionDetail {
  id: string;
  status: string;
  billingType: string;
  nextDueDate: string | null;
  startedAt: string;
  cancelledAt: string | null;
  notes: string | null;
  createdAt: string;
  patient: {
    id: string;
    name: string | null;
    phone: string;
    email: string | null;
    birthDate: string | null;
    klingoPatientId: number | null;
    source: string | null;
  };
  plan: {
    id: string;
    name: string;
    slug: string;
    priceCents: number;
    description: string | null;
    features: string[] | null;
  };
  payments: Payment[];
}

interface Payment {
  id: string;
  status: string;
  amountCents: number;
  dueDate: string | null;
  paidAt: string | null;
  invoiceUrl: string | null;
  billingType: string | null;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  description: string;
  features: string[];
}

interface Props {
  subscriptionId: string;
  onClose: () => void;
  onUpdated: () => void;
}

/* ── helpers ───────────────────────────────── */

const STATUS_CONFIG: Record<string, { label: string; bg: string; dot: string }> = {
  active:    { label: 'Ativa',        bg: 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20', dot: 'bg-emerald-500' },
  pending:   { label: 'Pendente',     bg: 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20',       dot: 'bg-amber-500' },
  overdue:   { label: 'Inadimplente', bg: 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20',           dot: 'bg-rose-500' },
  suspended: { label: 'Suspensa',     bg: 'bg-orange-500/10 text-orange-700 ring-1 ring-orange-500/20',     dot: 'bg-orange-500' },
  cancelled: { label: 'Cancelada',    bg: 'bg-slate-500/10 text-slate-500 ring-1 ring-slate-500/20',        dot: 'bg-slate-400' },
};

const PAYMENT_STATUS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING:   { label: 'Pendente',  color: 'text-amber-600 bg-amber-50',     icon: Clock },
  RECEIVED:  { label: 'Pago',      color: 'text-emerald-600 bg-emerald-50', icon: CheckCircle2 },
  CONFIRMED: { label: 'Confirmado', color: 'text-emerald-600 bg-emerald-50', icon: CheckCircle2 },
  OVERDUE:   { label: 'Vencido',   color: 'text-rose-600 bg-rose-50',       icon: AlertCircle },
  REFUNDED:  { label: 'Estornado', color: 'text-blue-600 bg-blue-50',       icon: RefreshCw },
};

const PLAN_ICONS: Record<string, React.ElementType> = {
  'prime-essencial': Shield,
  'prime-plus': Crown,
  'prime-elite': Gem,
};

const PLAN_GRADIENTS: Record<string, string> = {
  'prime-essencial': 'from-teal-500 to-emerald-600',
  'prime-plus': 'from-blue-500 to-indigo-600',
  'prime-elite': 'from-amber-500 to-orange-600',
};

const PLAN_BG: Record<string, string> = {
  'prime-essencial': 'from-teal-600/5 via-emerald-600/3 to-transparent',
  'prime-plus': 'from-blue-600/5 via-indigo-600/3 to-transparent',
  'prime-elite': 'from-amber-600/5 via-orange-600/3 to-transparent',
};

function fmt(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR');
}

function fmtDateTime(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

type Tab = 'info' | 'payments' | 'actions';

/* ── component ─────────────────────────────── */

export default function SubscriptionDetailModal({ subscriptionId, onClose, onUpdated }: Props) {
  const [data, setData] = useState<SubscriptionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('info');
  const [showPatient, setShowPatient] = useState(false);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [changingPlan, setChangingPlan] = useState(false);
  const [selectedNewPlan, setSelectedNewPlan] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const loadDetail = () => {
    setLoading(true);
    api.getSubscriptionDetail(subscriptionId)
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDetail(); }, [subscriptionId]);

  useEffect(() => {
    if (tab === 'actions' && plans.length === 0) {
      api.getPlans().then(d => setPlans(d.plans));
    }
  }, [tab]);

  const doAction = async (fn: () => Promise<any>, successMsg: string) => {
    setActionLoading(true);
    setActionError('');
    try {
      await fn();
      setActionSuccess(successMsg);
      loadDetail();
      onUpdated();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangePlan = () => {
    if (!selectedNewPlan) return;
    doAction(
      () => api.changeSubscriptionPlan(subscriptionId, selectedNewPlan),
      'Plano alterado com sucesso!',
    ).then(() => { setChangingPlan(false); setSelectedNewPlan(null); });
  };

  const handleCancel = async () => {
    if (!confirm('Tem certeza que deseja cancelar esta assinatura? Esta ação não pode ser desfeita.')) return;
    doAction(() => api.cancelSubscription(subscriptionId), 'Assinatura cancelada');
  };

  const st = data ? (STATUS_CONFIG[data.status] || STATUS_CONFIG.cancelled) : null;
  const PlanIcon = data ? (PLAN_ICONS[data.plan.slug] || Shield) : Shield;
  const planGradient = data ? (PLAN_GRADIENTS[data.plan.slug] || 'from-slate-500 to-slate-600') : '';
  const planBg = data ? (PLAN_BG[data.plan.slug] || 'from-slate-50 to-transparent') : '';

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'info', label: 'Detalhes', icon: Zap },
    { key: 'payments', label: 'Pagamentos', icon: Receipt },
    { key: 'actions', label: 'Ações', icon: RefreshCw },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop animate-fade-in" onClick={onClose}>
        <div
          className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl shadow-black/15 overflow-hidden animate-slide-up max-h-[90vh] flex flex-col relative"
          onClick={e => e.stopPropagation()}
        >

          {loading || !data ? (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-10 h-10 rounded-full border-2 border-slate-200 border-t-emerald-500 animate-spin" />
              <p className="text-sm text-slate-400 mt-4">Carregando detalhes...</p>
            </div>
          ) : (
            <>
              {/* Header with plan-colored gradient wash */}
              <div className={`relative bg-gradient-to-b ${planBg}`}>
                <div className="px-7 pt-6 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${planGradient} flex items-center justify-center shadow-lg shadow-emerald-500/10`}>
                        <PlanIcon size={22} className="text-white" />
                      </div>
                      <div>
                        <button
                          onClick={() => setShowPatient(true)}
                          className="text-lg font-bold text-slate-900 hover:text-emerald-700 transition-colors flex items-center gap-1 group"
                        >
                          {data.patient.name || 'Paciente'}
                          <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
                        </button>
                        <div className="flex items-center gap-2.5 mt-1">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${st!.bg}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st!.dot}`} />
                            {st!.label}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">{data.plan.name} · {fmt(data.plan.priceCents)}/mês</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={onClose}
                      className="w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-black/10 transition-all mt-0.5"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="flex gap-1 mt-5 border-b border-slate-100 -mx-7 px-7">
                    {tabs.map(t => {
                      const isActive = tab === t.key;
                      return (
                        <button
                          key={t.key}
                          onClick={() => setTab(t.key)}
                          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-all duration-200 border-b-2 -mb-px ${
                            isActive
                              ? 'border-emerald-500 text-emerald-700'
                              : 'border-transparent text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          <t.icon size={13} />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-7 modal-scroll">

                {/* ── Tab: Info ── */}
                {tab === 'info' && (
                  <div className="animate-fade-in space-y-5">
                    {/* Key metrics row */}
                    <div className="grid grid-cols-2 gap-3">
                      <InfoCard label="Plano" value={data.plan.name} sub={fmt(data.plan.priceCents) + '/mês'} accent="emerald" />
                      <InfoCard
                        label="Cobrança"
                        value={data.billingType === 'CREDIT_CARD' ? 'Cartão' : data.billingType}
                        icon={data.billingType === 'PIX' ? <QrCode size={14} /> : data.billingType === 'BOLETO' ? <FileText size={14} /> : <CreditCard size={14} />}
                        accent="blue"
                      />
                    </div>

                    {/* Timeline dates */}
                    <div className="relative bg-slate-50/80 rounded-2xl p-5 border border-slate-100">
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Calendar size={11} className="text-slate-400" />
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Início</span>
                          </div>
                          <p className="text-sm font-semibold text-slate-800 tabular-nums">{fmtDate(data.startedAt?.slice(0, 10) || null)}</p>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Clock size={11} className="text-slate-400" />
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Próx. Vencimento</span>
                          </div>
                          <p className="text-sm font-semibold text-slate-800 tabular-nums">{fmtDate(data.nextDueDate)}</p>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Calendar size={11} className="text-slate-400" />
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Criada em</span>
                          </div>
                          <p className="text-sm font-semibold text-slate-800 tabular-nums">{fmtDate(data.createdAt?.slice(0, 10) || null)}</p>
                        </div>
                      </div>
                      {data.cancelledAt && (
                        <div className="mt-4 pt-4 border-t border-slate-200">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Ban size={11} className="text-rose-400" />
                            <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider">Cancelada em</span>
                          </div>
                          <p className="text-sm font-semibold text-rose-600 tabular-nums">{fmtDateTime(data.cancelledAt)}</p>
                        </div>
                      )}
                    </div>

                    {data.notes && (
                      <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200/40">
                        <div className="flex items-center gap-2 mb-1.5">
                          <StickyNote size={12} className="text-amber-500" />
                          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Observações</span>
                        </div>
                        <p className="text-sm text-amber-900/80 leading-relaxed">{data.notes}</p>
                      </div>
                    )}

                    {/* Plan features */}
                    {Array.isArray(data.plan.features) && data.plan.features.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Benefícios do Plano</p>
                        <div className="grid grid-cols-2 gap-2">
                          {data.plan.features.map((feat, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2.5 text-sm text-slate-700 bg-white rounded-xl px-3.5 py-2.5 border border-slate-100 animate-stagger-in"
                              style={{ animationDelay: `${i * 50}ms` }}
                            >
                              <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                              <span className="text-[13px] leading-snug">{feat}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab: Payments ── */}
                {tab === 'payments' && (
                  <div className="animate-fade-in">
                    {data.payments.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 flex items-center justify-center mx-auto mb-4 shadow-sm">
                          <Receipt size={26} className="text-slate-300" />
                        </div>
                        <p className="text-slate-600 font-semibold text-sm">Nenhum pagamento registrado</p>
                        <p className="text-slate-400 text-xs mt-1.5">Os pagamentos aparecerão aqui quando forem gerados</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {data.payments.map((p, i) => {
                          const ps = PAYMENT_STATUS[p.status] || { label: p.status, color: 'text-slate-600 bg-slate-50', icon: Clock };
                          const StatusIcon = ps.icon;
                          return (
                            <div
                              key={p.id}
                              className="flex items-center gap-4 bg-white rounded-xl px-4 py-3.5 border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all duration-200 animate-stagger-in"
                              style={{ animationDelay: `${i * 40}ms` }}
                            >
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${ps.color}`}>
                                <StatusIcon size={15} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-800 tabular-nums">{fmt(p.amountCents)}</span>
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${ps.color}`}>
                                    {ps.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                                  <span className="tabular-nums">Venc: {fmtDate(p.dueDate)}</span>
                                  {p.paidAt && <span className="tabular-nums">Pago: {fmtDate(p.paidAt.slice(0, 10))}</span>}
                                </div>
                              </div>
                              {p.invoiceUrl && (
                                <a
                                  href={p.invoiceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all shrink-0"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <ExternalLink size={13} />
                                </a>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab: Actions ── */}
                {tab === 'actions' && (
                  <div className="animate-fade-in space-y-4">

                    {actionSuccess && (
                      <div className="flex items-center gap-2.5 text-emerald-700 text-sm bg-emerald-50 px-4 py-3 rounded-xl border border-emerald-200/50 animate-slide-up">
                        <CheckCircle2 size={15} /> {actionSuccess}
                      </div>
                    )}
                    {actionError && (
                      <div className="flex items-center gap-2.5 text-rose-600 text-sm bg-rose-50 px-4 py-3 rounded-xl border border-rose-200/50">
                        <AlertCircle size={15} /> {actionError}
                      </div>
                    )}

                    {/* Change Plan */}
                    {data.status === 'active' && (
                      <ActionCard
                        icon={<RefreshCw size={16} />}
                        iconColor="text-blue-600 bg-blue-50"
                        title="Trocar Plano"
                        description={`Plano atual: ${data.plan.name} — ${fmt(data.plan.priceCents)}/mês`}
                        actionLabel={changingPlan ? undefined : 'Alterar'}
                        onAction={() => setChangingPlan(true)}
                      >
                        {changingPlan && (
                          <div className="space-y-2 mt-3 animate-fade-in">
                            {plans.filter(p => p.id !== data.plan.id).map(plan => {
                              const Icon = PLAN_ICONS[plan.slug] || Shield;
                              const gradient = PLAN_GRADIENTS[plan.slug] || 'from-slate-500 to-slate-600';
                              const isSelected = selectedNewPlan === plan.id;
                              return (
                                <button
                                  key={plan.id}
                                  onClick={() => setSelectedNewPlan(plan.id)}
                                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                                    isSelected ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
                                    <Icon size={16} className="text-white" />
                                  </div>
                                  <div className="flex-1">
                                    <span className="font-semibold text-sm text-slate-900">{plan.name}</span>
                                    <span className="block text-xs text-slate-500 tabular-nums">{fmt(plan.priceCents)}/mês</span>
                                  </div>
                                  {isSelected && <CheckCircle2 size={18} className="text-blue-500" />}
                                </button>
                              );
                            })}
                            <div className="flex gap-2 mt-3">
                              <button onClick={() => { setChangingPlan(false); setSelectedNewPlan(null); }} className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all">
                                Cancelar
                              </button>
                              <button
                                onClick={handleChangePlan}
                                disabled={!selectedNewPlan || actionLoading}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
                              >
                                {actionLoading ? <Loader2 size={13} className="animate-spin" /> : null}
                                Confirmar Troca
                              </button>
                            </div>
                          </div>
                        )}
                      </ActionCard>
                    )}

                    {/* Suspend / Reactivate */}
                    {(data.status === 'active' || data.status === 'suspended') && (
                      <ActionCard
                        icon={data.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                        iconColor={data.status === 'active' ? 'text-orange-600 bg-orange-50' : 'text-emerald-600 bg-emerald-50'}
                        title={data.status === 'active' ? 'Suspender Assinatura' : 'Reativar Assinatura'}
                        description={data.status === 'active'
                          ? 'A assinatura será pausada e o paciente será notificado.'
                          : 'A assinatura voltará ao status ativo e o paciente será notificado.'}
                      >
                        <button
                          onClick={() => doAction(
                            () => data.status === 'active' ? api.suspendSubscription(subscriptionId) : api.reactivateSubscription(subscriptionId),
                            data.status === 'active' ? 'Assinatura suspensa' : 'Assinatura reativada',
                          )}
                          disabled={actionLoading}
                          className={`w-full mt-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                            data.status === 'active'
                              ? 'bg-orange-50 text-orange-700 border border-orange-200/60 hover:bg-orange-100'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100'
                          }`}
                        >
                          {actionLoading && <Loader2 size={13} className="animate-spin" />}
                          {data.status === 'active' ? 'Suspender' : 'Reativar'}
                        </button>
                      </ActionCard>
                    )}

                    {/* Cancel */}
                    {data.status !== 'cancelled' && (
                      <ActionCard
                        icon={<XCircle size={16} />}
                        iconColor="text-rose-600 bg-rose-50"
                        title="Cancelar Assinatura"
                        description="Esta ação é irreversível. O paciente será notificado via WhatsApp."
                        danger
                      >
                        <button
                          onClick={handleCancel}
                          disabled={actionLoading}
                          className="w-full mt-3 py-2.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/60 hover:bg-rose-100 transition-all duration-200 flex items-center justify-center gap-1.5"
                        >
                          {actionLoading && <Loader2 size={13} className="animate-spin" />}
                          Cancelar Assinatura
                        </button>
                      </ActionCard>
                    )}

                    {data.status === 'cancelled' && (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/60 flex items-center justify-center mx-auto mb-4 shadow-sm">
                          <Ban size={26} className="text-slate-300" />
                        </div>
                        <p className="text-slate-500 font-semibold text-sm">Assinatura cancelada</p>
                        <p className="text-slate-400 text-xs mt-1">Não há ações disponíveis</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showPatient && data && (
        <PatientDetailModal
          patientId={data.patient.id}
          onClose={() => setShowPatient(false)}
        />
      )}
    </>
  );
}

/* ── Sub-components ── */

function InfoCard({ label, value, sub, icon, accent = 'slate' }: {
  label: string; value: string; sub?: string; icon?: React.ReactNode; accent?: string;
}) {
  const accentMap: Record<string, string> = {
    emerald: 'border-l-emerald-500',
    blue: 'border-l-blue-500',
    slate: 'border-l-slate-300',
  };
  return (
    <div className={`bg-white rounded-xl p-4 border border-slate-100 border-l-[3px] ${accentMap[accent] || accentMap.slate}`}>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
      <p className="text-sm font-bold text-slate-800 mt-1.5 flex items-center gap-1.5">
        {icon && <span className="text-slate-400">{icon}</span>}
        {value}
      </p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">{sub}</p>}
    </div>
  );
}

function ActionCard({ icon, iconColor, title, description, actionLabel, onAction, danger, children }: {
  icon: React.ReactNode; iconColor: string; title: string; description: string;
  actionLabel?: string; onAction?: () => void; danger?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl p-5 border transition-all duration-200 ${
      danger ? 'bg-rose-50/30 border-rose-200/40' : 'bg-white border-slate-200/60'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
            {icon}
          </div>
          <div>
            <span className="font-semibold text-slate-900 text-sm">{title}</span>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
          </div>
        </div>
        {actionLabel && onAction && (
          <button onClick={onAction} className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors shrink-0 mt-0.5">
            {actionLabel}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
