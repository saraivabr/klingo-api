import React, { useEffect, useState } from 'react';
import {
  X, Search, CreditCard, QrCode, FileText,
  CheckCircle2, AlertCircle, User, Mail,
  ChevronRight, ChevronDown, Loader2, Shield, Crown, Gem,
  ArrowLeft, XCircle, Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';

/* ── types ─────────────────────────────────── */

interface Plan {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  priceSemestralCents: number | null;
  priceAnnualCents: number | null;
  description: string;
  features: string[];
}

interface KlingoPatient {
  klingoId: number;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  birthDate: string;
}

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

/* ── helpers ───────────────────────────────── */

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

const STEPS = [
  { key: 'search', label: 'Buscar' },
  { key: 'patient', label: 'Dados' },
  { key: 'plan', label: 'Plano' },
  { key: 'confirm', label: 'Confirmar' },
];

function fmt(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function maskCpf(v: string): string {
  const nums = v.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 3) return nums;
  if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
  if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9)}`;
}

function maskPhone(v: string): string {
  const nums = v.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 2) return nums;
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
}

type WizardStep = 'search' | 'patient' | 'plan' | 'confirm' | 'pix' | 'success';

type BillingCycle = 'MONTHLY' | 'SEMIANNUALLY' | 'YEARLY';

const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  MONTHLY: 'Mensal',
  SEMIANNUALLY: 'Semestral',
  YEARLY: 'Anual',
};

const BILLING_CYCLE_SUFFIXES: Record<BillingCycle, string> = {
  MONTHLY: '/mês',
  SEMIANNUALLY: '/6 meses',
  YEARLY: '/ano',
};

function getPlanPriceForCycle(plan: Plan, billingCycle: BillingCycle): number | null {
  if (billingCycle === 'SEMIANNUALLY') return plan.priceSemestralCents;
  if (billingCycle === 'YEARLY') return plan.priceAnnualCents;
  return plan.priceCents;
}

function getAvailableBillingCycles(plan: Plan): BillingCycle[] {
  const cycles: BillingCycle[] = ['MONTHLY'];
  if (plan.priceSemestralCents !== null && plan.priceSemestralCents !== undefined) cycles.push('SEMIANNUALLY');
  if (plan.priceAnnualCents !== null && plan.priceAnnualCents !== undefined) cycles.push('YEARLY');
  return cycles;
}

/* ── component ─────────────────────────────── */

export default function NewSubscriptionWizard({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<WizardStep>('search');
  const [plans, setPlans] = useState<Plan[]>([]);

  const [cpfSearch, setCpfSearch] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [klingoPatient, setKlingoPatient] = useState<KlingoPatient | null>(null);
  const [klingoMultiple, setKlingoMultiple] = useState<KlingoPatient[]>([]);
  const [searchDone, setSearchDone] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [patientForm, setPatientForm] = useState({
    name: '', phone: '', cpf: '', email: '', klingoId: 0,
  });

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [billingType, setBillingType] = useState<'PIX' | 'BOLETO' | 'CREDIT_CARD'>('PIX');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [expandedFeatures, setExpandedFeatures] = useState<string | null>(null);
  const [igsPlanDefaults, setIgsPlanDefaults] = useState<Record<string, { id: string; name: string }[]>>({});

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [pixInfo, setPixInfo] = useState<{ qrCodeImage: string; qrCodePayload: string; invoiceUrl?: string; paymentId?: string } | null>(null);
  const [pixCopied, setPixCopied] = useState(false);

  useEffect(() => {
    if (plans.length === 0) {
      api.getPlans().then(data => setPlans(data.plans));
    }
    api.getIGSPlanDefaults().then(defaults => {
      const map: Record<string, { id: string; name: string }[]> = {};
      for (const d of defaults) map[d.planSlug] = d.products;
      setIgsPlanDefaults(map);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedPlan) return;
    const availableCycles = getAvailableBillingCycles(selectedPlan);
    if (!availableCycles.includes(billingCycle)) {
      setBillingCycle(availableCycles[0] || 'MONTHLY');
    }
  }, [selectedPlan, billingCycle]);

  const handleKlingoSearch = async () => {
    const cpfClean = cpfSearch.replace(/\D/g, '');
    const phoneClean = phoneSearch.replace(/\D/g, '');
    if (!cpfClean && !phoneClean) {
      setSearchError('Informe CPF ou telefone');
      return;
    }
    setSearching(true);
    setSearchError('');
    setSearchDone(false);
    setKlingoPatient(null);
    setKlingoMultiple([]);
    try {
      const params: { cpf?: string; phone?: string } = {};
      if (cpfClean) params.cpf = cpfClean;
      else params.phone = phoneClean;
      const result = await api.searchPatientKlingo(params);
      if (result.found && (result as any).multiple && (result as any).patients) {
        setKlingoMultiple((result as any).patients);
      } else if (result.found && result.patient) {
        setKlingoPatient(result.patient);
        setPatientForm({
          name: result.patient.name || '',
          phone: result.patient.phone || phoneClean,
          cpf: result.patient.cpf || cpfClean,
          email: result.patient.email || '',
          klingoId: result.patient.klingoId || 0,
        });
      } else {
        setPatientForm(f => ({ ...f, cpf: cpfClean, phone: phoneClean }));
      }
      setSearchDone(true);
    } catch (err: any) {
      setSearchError(err.message || 'Erro na busca');
    } finally {
      setSearching(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedPlan) return;
    setCreating(true);
    setCreateError('');
    try {
      const patient = await api.ensurePatient({
        phone: patientForm.phone.replace(/\D/g, ''),
        name: patientForm.name,
        cpf: patientForm.cpf.replace(/\D/g, ''),
        klingoId: patientForm.klingoId || undefined,
        email: patientForm.email || undefined,
      });

      const result = await api.createSubscription({
        patientId: patient.id,
        planId: selectedPlan.id,
        billingType,
        billingCycle,
        cpf: patientForm.cpf.replace(/\D/g, ''),
        email: patientForm.email || undefined,
      });

      // If PIX data returned, show QR code screen
      if (billingType === 'PIX' && !result.asaas?.pix) {
        throw new Error('Não foi possível gerar o QR Code PIX. Tente novamente.');
      }

      if (result.asaas?.pix) {
        setPixInfo({
          qrCodeImage: result.asaas.pix.qrCodeImage,
          qrCodePayload: result.asaas.pix.qrCodePayload,
          invoiceUrl: result.asaas.invoiceUrl,
          paymentId: result.asaas.paymentId,
        });
        setStep('pix');
        onCreated(); // refresh list in background
      } else {
        setStep('success');
        setTimeout(() => {
          onCreated();
          onClose();
        }, 2200);
      }
    } catch (err: any) {
      setCreateError(err.message || 'Erro ao criar assinatura');
    } finally {
      setCreating(false);
    }
  };

  const currentStepIndex = STEPS.findIndex(s => s.key === step);
  const selectedPlanPrice = selectedPlan ? getPlanPriceForCycle(selectedPlan, billingCycle) : null;
  const selectedBillingCycleLabel = BILLING_CYCLE_LABELS[billingCycle];
  const selectedBillingCycleSuffix = BILLING_CYCLE_SUFFIXES[billingCycle];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl shadow-black/15 overflow-hidden animate-slide-up relative">

        {/* Step indicator — connected dots */}
        {step !== 'success' && step !== 'pix' && (
          <div className="px-7 pt-5 pb-1">
            <div className="flex items-center justify-between">
              {STEPS.map((s, i) => {
                const isPast = i < currentStepIndex;
                const isCurrent = i === currentStepIndex;
                return (
                  <React.Fragment key={s.key}>
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                        isPast ? 'bg-emerald-500 text-white' :
                        isCurrent ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' :
                        'bg-slate-100 text-slate-400'
                      }`}>
                        {isPast ? <CheckCircle2 size={14} /> : i + 1}
                      </div>
                      <span className={`text-[9px] font-semibold uppercase tracking-wider ${
                        isCurrent ? 'text-slate-700' : 'text-slate-400'
                      }`}>{s.label}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`flex-1 h-px mx-2 -mt-4 transition-colors duration-300 ${
                        i < currentStepIndex ? 'bg-emerald-400' : 'bg-slate-200'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* close */}
        {step !== 'success' && step !== 'pix' && (
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-black/5 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-black/10 transition-all z-10">
            <X size={15} />
          </button>
        )}

        <div className="p-7">

          {/* ── Success ── */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center py-12 animate-scale-in">
              {/* Animated success ring */}
              <div className="relative w-24 h-24 mb-6">
                <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-pulse-ring" />
                <div className="absolute inset-0 rounded-full bg-emerald-500/5 animate-pulse-ring" style={{ animationDelay: '0.3s' }} />
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-xl shadow-emerald-500/25">
                  <CheckCircle2 size={44} className="text-white" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Assinatura Criada!</h3>
              <p className="text-sm text-slate-500 text-center max-w-xs leading-relaxed">
                O paciente receberá uma mensagem de boas-vindas via WhatsApp em instantes.
              </p>
            </div>
          )}

          {/* ── PIX Payment ── */}
          {step === 'pix' && pixInfo && selectedPlan && (
            <div className="flex flex-col items-center py-6 animate-fade-in">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                <QrCode size={24} className="text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Pagamento via PIX</h3>
              <p className="text-sm text-slate-500 mb-5 text-center">
                Escaneie o QR Code ou copie o código para pagar a 1ª cobrança
              </p>

              {/* QR Code Image */}
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 mb-4 shadow-sm">
                <img
                  src={`data:image/png;base64,${pixInfo.qrCodeImage}`}
                  alt="QR Code PIX"
                  className="w-52 h-52"
                />
              </div>

              {/* Amount */}
              <div className="text-center mb-4">
                <span className="text-2xl font-bold text-slate-900">{fmt(selectedPlanPrice ?? selectedPlan.priceCents)}</span>
                <span className="text-sm text-slate-500 ml-1">- {selectedPlan.name} · {selectedBillingCycleLabel}</span>
              </div>

              {/* Copy PIX code */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(pixInfo.qrCodePayload);
                  setPixCopied(true);
                  setTimeout(() => setPixCopied(false), 3000);
                }}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all mb-3 ${
                  pixCopied
                    ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {pixCopied ? (
                  <><CheckCircle2 size={16} /> Código copiado!</>
                ) : (
                  <><QrCode size={16} /> Copiar código PIX</>
                )}
              </button>

              {/* Invoice link */}
              {pixInfo.invoiceUrl && (
                <a
                  href={pixInfo.invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-all mb-3"
                >
                  <FileText size={16} /> Ver fatura completa
                </a>
              )}

              <button
                onClick={() => { onClose(); }}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors mt-2"
              >
                Fechar
              </button>
            </div>
          )}

          {/* ── Step 1: Search ── */}
          {step === 'search' && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Search size={18} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Buscar Paciente</h3>
                  <p className="text-xs text-slate-500">Busca no sistema Klingo para evitar duplicidade</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">CPF do paciente</label>
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={cpfSearch}
                    onChange={e => { setCpfSearch(maskCpf(e.target.value)); setSearchDone(false); setSearchError(''); }}
                    className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 focus:bg-white transition-all tabular-nums"
                  />
                </div>

                <div className="relative flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold bg-white px-2">ou</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Telefone</label>
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={phoneSearch}
                    onChange={e => { setPhoneSearch(maskPhone(e.target.value)); setSearchDone(false); setSearchError(''); }}
                    className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 focus:bg-white transition-all tabular-nums"
                  />
                </div>
              </div>

              {searchError && (
                <div className="mt-4 flex items-center gap-2.5 text-rose-600 text-sm bg-rose-50 px-4 py-2.5 rounded-xl border border-rose-200/50">
                  <AlertCircle size={15} /> {searchError}
                </div>
              )}

              {searchDone && (
                <div className="mt-5 animate-slide-up">
                  {klingoPatient ? (
                    <div className="bg-emerald-50/60 border border-emerald-200/50 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 size={15} className="text-emerald-600" />
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Paciente encontrado</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wider">Nome</span><p className="font-semibold text-slate-900 mt-0.5">{klingoPatient.name}</p></div>
                        <div><span className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wider">CPF</span><p className="font-medium text-slate-700 tabular-nums mt-0.5">{klingoPatient.cpf || '—'}</p></div>
                        <div><span className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wider">Telefone</span><p className="font-medium text-slate-700 tabular-nums mt-0.5">{klingoPatient.phone || '—'}</p></div>
                        <div><span className="text-emerald-600 text-[10px] font-semibold uppercase tracking-wider">Klingo ID</span><p className="font-medium text-slate-700 mt-0.5">#{klingoPatient.klingoId}</p></div>
                      </div>
                    </div>
                  ) : klingoMultiple.length > 0 ? (
                    <div className="bg-blue-50/60 border border-blue-200/50 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <User size={15} className="text-blue-600" />
                        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">Múltiplos resultados — selecione</span>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto modal-scroll">
                        {klingoMultiple.map(p => (
                          <button
                            key={p.klingoId}
                            onClick={() => {
                              setKlingoPatient(p);
                              setKlingoMultiple([]);
                              setPatientForm({ name: p.name || '', phone: p.phone || '', cpf: p.cpf || '', email: '', klingoId: p.klingoId || 0 });
                            }}
                            className="w-full flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-blue-100 hover:border-blue-300 hover:shadow-sm transition-all text-left"
                          >
                            <div>
                              <span className="font-semibold text-sm text-slate-900">{p.name}</span>
                              <span className="block text-[11px] text-slate-500 tabular-nums mt-0.5">CPF: {p.cpf || '—'} · Tel: {p.phone || '—'}</span>
                            </div>
                            <ChevronRight size={14} className="text-slate-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50/60 border border-amber-200/50 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle size={15} className="text-amber-600" />
                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Não encontrado</span>
                      </div>
                      <p className="text-sm text-amber-700/80">Preencha os dados manualmente na próxima etapa.</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 mt-7">
                {!searchDone ? (
                  <button
                    onClick={handleKlingoSearch}
                    disabled={searching || (!cpfSearch.replace(/\D/g, '') && !phoneSearch.replace(/\D/g, ''))}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                    {searching ? 'Buscando...' : 'Buscar na Klingo'}
                  </button>
                ) : (
                  <button
                    onClick={() => setStep('patient')}
                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/15"
                  >
                    Continuar <ChevronRight size={16} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Step 2: Patient Data ── */}
          {step === 'patient' && (
            <div className="animate-fade-in">
              <button onClick={() => setStep('search')} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-4 -mt-1 transition-colors">
                <ArrowLeft size={13} /> Voltar
              </button>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <User size={18} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Dados do Paciente</h3>
                  <p className="text-xs text-slate-500">{klingoPatient ? 'Confirme os dados do Klingo' : 'Preencha os dados manualmente'}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Nome completo *</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      type="text"
                      value={patientForm.name}
                      onChange={e => setPatientForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition-all"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">CPF *</label>
                    <input
                      type="text"
                      value={maskCpf(patientForm.cpf)}
                      onChange={e => setPatientForm(f => ({ ...f, cpf: e.target.value.replace(/\D/g, '') }))}
                      className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition-all tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Telefone *</label>
                    <input
                      type="text"
                      value={maskPhone(patientForm.phone)}
                      onChange={e => setPatientForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
                      className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition-all tabular-nums"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Email (opcional)</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
                    <input
                      type="email"
                      value={patientForm.email}
                      onChange={e => setPatientForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="paciente@email.com"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-medium placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (!patientForm.name || !patientForm.cpf || !patientForm.phone) {
                    setCreateError('Preencha nome, CPF e telefone');
                    return;
                  }
                  setCreateError('');
                  setStep('plan');
                }}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all mt-7"
              >
                Escolher Plano <ChevronRight size={16} />
              </button>
              {createError && <p className="text-rose-600 text-xs mt-2 text-center font-medium">{createError}</p>}
            </div>
          )}

          {/* ── Step 3: Plan Selection ── */}
          {step === 'plan' && (
            <div className="animate-fade-in">
              <button onClick={() => setStep('patient')} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-4 -mt-1 transition-colors">
                <ArrowLeft size={13} /> Voltar
              </button>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Crown size={18} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Escolha o Plano</h3>
                  <p className="text-xs text-slate-500">Selecione o plano e forma de cobrança</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {plans.map((plan, i) => {
                  const Icon = PLAN_ICONS[plan.slug] || Shield;
                  const gradient = PLAN_GRADIENTS[plan.slug] || 'from-slate-500 to-slate-600';
                  const isSelected = selectedPlan?.id === plan.id;
                  const isExpanded = expandedFeatures === plan.id;
                  const features = Array.isArray(plan.features) ? plan.features : [];
                  return (
                    <div key={plan.id} className="animate-stagger-in" style={{ animationDelay: `${i * 60}ms` }}>
                      <button
                        onClick={() => {
                          setSelectedPlan(plan);
                          setExpandedFeatures(isExpanded ? null : plan.id);
                        }}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50/40 shadow-md shadow-emerald-500/8'
                            : 'border-slate-200/80 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-lg ${isSelected ? 'shadow-emerald-500/15' : 'shadow-slate-300/20'}`}>
                          <Icon size={20} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{plan.name}</span>
                            <span className="font-bold text-slate-900 tabular-nums">{fmt(plan.priceCents)}<span className="text-slate-400 font-normal text-[11px]">/mês</span></span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">{plan.description}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isSelected && <CheckCircle2 size={20} className="text-emerald-500" />}
                          {features.length > 0 && (
                            <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="mt-1.5 ml-[60px] mr-2 animate-fade-in space-y-2">
                          {features.length > 0 && (
                            <div className="bg-slate-50/80 rounded-xl p-3 space-y-1.5 border border-slate-100">
                              {features.map((feat, fi) => (
                                <div key={fi} className="flex items-start gap-2 text-xs text-slate-600">
                                  <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                                  <span>{feat}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {igsPlanDefaults[plan.slug] && igsPlanDefaults[plan.slug].length > 0 && (
                            <div className="bg-blue-50/80 rounded-xl p-3 border border-blue-100">
                              <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest mb-2">Assistências IGS incluídas</p>
                              <div className="flex flex-wrap gap-1.5">
                                {igsPlanDefaults[plan.slug].map(prod => (
                                  <span key={prod.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-blue-100/80 text-blue-700">
                                    <Shield size={10} />
                                    {prod.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedPlan && (
                <div className="mb-6">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Periodicidade</label>
                  <div className="grid grid-cols-3 gap-2">
                    {getAvailableBillingCycles(selectedPlan).map(cycle => {
                      const price = getPlanPriceForCycle(selectedPlan, cycle);
                      return (
                        <button
                          key={cycle}
                          onClick={() => setBillingCycle(cycle)}
                          className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-semibold transition-all duration-200 ${
                            billingCycle === cycle
                              ? 'border-emerald-500 bg-emerald-50/60 text-emerald-700 shadow-sm'
                              : 'border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          <span>{BILLING_CYCLE_LABELS[cycle]}</span>
                          <span className="text-[11px] font-medium tabular-nums text-slate-400">
                            {fmt(price ?? 0)}{BILLING_CYCLE_SUFFIXES[cycle]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Billing Type */}
              <div className="mb-6">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Forma de Cobrança</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'PIX' as const, icon: QrCode, label: 'PIX' },
                    { key: 'BOLETO' as const, icon: FileText, label: 'Boleto' },
                    { key: 'CREDIT_CARD' as const, icon: CreditCard, label: 'Cartão' },
                  ]).map(bt => (
                    <button
                      key={bt.key}
                      onClick={() => setBillingType(bt.key)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-semibold transition-all duration-200 ${
                        billingType === bt.key
                          ? 'border-emerald-500 bg-emerald-50/60 text-emerald-700 shadow-sm'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      <bt.icon size={18} />
                      {bt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => selectedPlan && setStep('confirm')}
                disabled={!selectedPlan}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Revisar <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* ── Step 4: Confirm ── */}
          {step === 'confirm' && selectedPlan && (
            <div className="animate-fade-in">
              <button onClick={() => setStep('plan')} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-4 -mt-1 transition-colors">
                <ArrowLeft size={13} /> Voltar
              </button>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <Sparkles size={18} className="text-violet-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Confirmar Assinatura</h3>
                  <p className="text-xs text-slate-500">Revise os dados antes de criar</p>
                </div>
              </div>

              <div className="bg-slate-50/80 rounded-2xl p-5 space-y-3.5 border border-slate-100">
                {[
                  { label: 'Paciente', value: patientForm.name, bold: true },
                  { label: 'CPF', value: maskCpf(patientForm.cpf), mono: true },
                  { label: 'Telefone', value: maskPhone(patientForm.phone), mono: true },
                  { label: 'Plano', value: selectedPlan.name, bold: true },
                  { label: 'Periodicidade', value: selectedBillingCycleLabel, accent: true },
                  { label: 'Valor', value: `${fmt(selectedPlanPrice ?? selectedPlan.priceCents)}${selectedBillingCycleSuffix}`, accent: true },
                  { label: 'Cobrança', value: billingType === 'CREDIT_CARD' ? 'Cartão' : billingType },
                  ...(klingoPatient ? [{ label: 'Klingo ID', value: '#' + klingoPatient.klingoId, accent: true }] : []),
                ].map((row, i) => (
                  <React.Fragment key={row.label}>
                    {i > 0 && <div className="h-px bg-slate-200/60" />}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{row.label}</span>
                      <span className={`text-sm ${
                        (row as any).bold ? 'font-bold text-slate-900' :
                        (row as any).accent ? 'font-bold text-emerald-700' :
                        (row as any).mono ? 'font-medium text-slate-700 tabular-nums' :
                        'font-medium text-slate-700'
                      }`}>{row.value}</span>
                    </div>
                  </React.Fragment>
                ))}
              </div>

              {/* Selected plan features */}
              {Array.isArray(selectedPlan.features) && selectedPlan.features.length > 0 && (
                <div className="mt-4 bg-emerald-50/40 rounded-xl p-4 border border-emerald-200/30">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-2.5">Benefícios inclusos</p>
                  <div className="space-y-1.5">
                    {selectedPlan.features.map((feat, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-emerald-800/80">
                        <CheckCircle2 size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* IGS benefits that will be auto-activated */}
              {igsPlanDefaults[selectedPlan.slug] && igsPlanDefaults[selectedPlan.slug].length > 0 && (
                <div className="mt-3 bg-blue-50/50 rounded-xl p-4 border border-blue-200/30">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2.5">Assistências IGS (ativação automática)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {igsPlanDefaults[selectedPlan.slug].map(prod => (
                      <span key={prod.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-blue-100/80 text-blue-700">
                        <Shield size={10} />
                        {prod.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-blue-500 mt-2">Serão ativados automaticamente ao criar a assinatura</p>
                </div>
              )}

              {createError && (
                <div className="mt-4 flex items-center gap-2.5 text-rose-600 text-sm bg-rose-50 px-4 py-2.5 rounded-xl border border-rose-200/50">
                  <XCircle size={15} /> {createError}
                </div>
              )}

              <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 rounded-xl text-sm font-bold shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 mt-6"
              >
                {creating ? (
                  <><Loader2 size={16} className="animate-spin" /> Criando assinatura...</>
                ) : (
                  <><Sparkles size={16} /> Criar Assinatura</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
