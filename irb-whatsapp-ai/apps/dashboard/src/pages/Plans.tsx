import React, { useEffect, useState } from 'react';
import {
  Shield, Crown, Gem, CheckCircle2, Edit3, Save, X,
  Loader2, Plus, Trash2, AlertCircle, Users,
} from 'lucide-react';
import { api } from '../services/api';

/* ── types ─────────────────────────────────── */

interface Plan {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  priceSemestralCents: number | null;
  priceAnnualCents: number | null;
  description: string | null;
  features: string[] | null;
  isActive: boolean;
  subscriberCount: number;
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

function fmt(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d,]/g, '').replace(',', '.');
  return Math.round(parseFloat(cleaned) * 100) || 0;
}

function formatInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/* ── component ─────────────────────────────── */

export default function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editPriceSemestral, setEditPriceSemestral] = useState('');
  const [editPriceAnnual, setEditPriceAnnual] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editFeatures, setEditFeatures] = useState<string[]>([]);
  const [editActive, setEditActive] = useState(true);
  const [newFeature, setNewFeature] = useState('');

  const loadPlans = () => {
    setLoading(true);
    api.getPlans()
      .then(data => setPlans(data.plans))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPlans(); }, []);

  const startEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setEditName(plan.name);
    setEditPrice(formatInput(plan.priceCents));
    setEditPriceSemestral(plan.priceSemestralCents ? formatInput(plan.priceSemestralCents) : '');
    setEditPriceAnnual(plan.priceAnnualCents ? formatInput(plan.priceAnnualCents) : '');
    setEditDescription(plan.description || '');
    setEditFeatures(Array.isArray(plan.features) ? [...plan.features] : []);
    setEditActive(plan.isActive);
    setNewFeature('');
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSaveError(null);
  };

  const handleSave = async (planId: string) => {
    const priceCents = parseCurrency(editPrice);
    if (priceCents <= 0) {
      setSaveError('Valor mensal deve ser maior que zero');
      return;
    }
    if (!editName.trim()) {
      setSaveError('Nome e obrigatorio');
      return;
    }

    const semestralTrimmed = editPriceSemestral.trim();
    const annualTrimmed = editPriceAnnual.trim();
    const priceSemestralCents = semestralTrimmed ? parseCurrency(semestralTrimmed) : null;
    const priceAnnualCents = annualTrimmed ? parseCurrency(annualTrimmed) : null;

    if (priceSemestralCents !== null && priceSemestralCents < 0) {
      setSaveError('Valor semestral invalido');
      return;
    }
    if (priceAnnualCents !== null && priceAnnualCents < 0) {
      setSaveError('Valor anual invalido');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await api.updatePlan(planId, {
        name: editName.trim(),
        priceCents,
        priceSemestralCents,
        priceAnnualCents,
        description: editDescription.trim() || undefined,
        features: editFeatures.length > 0 ? editFeatures : undefined,
        isActive: editActive,
      });
      setSaveSuccess(planId);
      setEditingId(null);
      loadPlans();
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const addFeature = () => {
    const feat = newFeature.trim();
    if (feat && !editFeatures.includes(feat)) {
      setEditFeatures([...editFeatures, feat]);
      setNewFeature('');
    }
  };

  const removeFeature = (index: number) => {
    setEditFeatures(editFeatures.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-emerald-500" />
          <p className="text-sm text-slate-400">Carregando planos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
          <Crown size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Planos</h1>
          <p className="text-sm text-slate-500">Gerencie valores, beneficios e status dos planos</p>
        </div>
      </div>

      {/* Plans grid */}
      <div className="space-y-4">
        {plans.map(plan => {
          const Icon = PLAN_ICONS[plan.slug] || Shield;
          const gradient = PLAN_GRADIENTS[plan.slug] || 'from-slate-500 to-slate-600';
          const isEditing = editingId === plan.id;
          const justSaved = saveSuccess === plan.id;

          return (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl border overflow-hidden transition-all duration-300 ${
                isEditing
                  ? 'border-blue-300 shadow-lg shadow-blue-500/10 ring-1 ring-blue-200'
                  : justSaved
                    ? 'border-emerald-300 shadow-md shadow-emerald-500/10'
                    : 'border-slate-200/60 hover:border-slate-300/60 hover:shadow-md'
              }`}
            >
              {/* Plan header */}
              <div className="flex items-center justify-between p-5 pb-0">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg shadow-slate-300/20`}>
                    <Icon size={22} className="text-white" />
                  </div>
                  <div>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="text-lg font-bold text-slate-900 bg-transparent border-b-2 border-blue-300 focus:border-blue-500 outline-none pb-0.5 w-64"
                      />
                    ) : (
                      <h2 className="text-lg font-bold text-slate-900">{plan.name}</h2>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        plan.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${plan.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {plan.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Users size={11} />
                        {plan.subscriberCount} assinante{plan.subscriberCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {!isEditing ? (
                    <>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-900 tabular-nums">{fmt(plan.priceCents)}</p>
                        <p className="text-[10px] text-slate-400 font-medium">por mes</p>
                        {(plan.priceSemestralCents || plan.priceAnnualCents) && (
                          <div className="flex items-center justify-end gap-2 mt-1.5 text-[10px] text-slate-500 tabular-nums">
                            {plan.priceSemestralCents ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="font-semibold">Sem:</span>
                                <span>{fmt(plan.priceSemestralCents)}</span>
                              </span>
                            ) : null}
                            {plan.priceSemestralCents && plan.priceAnnualCents ? (
                              <span className="text-slate-300">·</span>
                            ) : null}
                            {plan.priceAnnualCents ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="font-semibold">Anu:</span>
                                <span>{fmt(plan.priceAnnualCents)}</span>
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => startEdit(plan)}
                        className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                      >
                        <Edit3 size={16} />
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={cancelEdit}
                        className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-all"
                      >
                        <X size={15} />
                      </button>
                      <button
                        onClick={() => handleSave(plan.id)}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm"
                      >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        Salvar
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Edit form or display */}
              <div className="p-5 pt-4">
                {isEditing ? (
                  <div className="space-y-4 animate-fade-in">
                    {saveError && (
                      <div className="flex items-center gap-2 text-rose-600 text-sm bg-rose-50 px-3 py-2.5 rounded-xl border border-rose-200/50">
                        <AlertCircle size={14} /> {saveError}
                      </div>
                    )}

                    {/* Prices (mensal, semestral, anual) + Active toggle */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Mensal (R$)</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">R$</span>
                          <input
                            type="text"
                            value={editPrice}
                            onChange={e => {
                              const v = e.target.value.replace(/[^\d,]/g, '');
                              setEditPrice(v);
                            }}
                            className="w-full pl-10 pr-3 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all tabular-nums"
                            placeholder="100,00"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Semestral (R$)</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">R$</span>
                          <input
                            type="text"
                            value={editPriceSemestral}
                            onChange={e => {
                              const v = e.target.value.replace(/[^\d,]/g, '');
                              setEditPriceSemestral(v);
                            }}
                            className="w-full pl-10 pr-3 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all tabular-nums"
                            placeholder="livre"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Anual (R$)</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">R$</span>
                          <input
                            type="text"
                            value={editPriceAnnual}
                            onChange={e => {
                              const v = e.target.value.replace(/[^\d,]/g, '');
                              setEditPriceAnnual(v);
                            }}
                            className="w-full pl-10 pr-3 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all tabular-nums"
                            placeholder="livre"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Status toggle */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Status</label>
                      <button
                        onClick={() => setEditActive(!editActive)}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                          editActive
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                            : 'border-slate-300 bg-slate-50 text-slate-500'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${editActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {editActive ? 'Ativo' : 'Inativo'}
                      </button>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Descricao</label>
                      <input
                        type="text"
                        value={editDescription}
                        onChange={e => setEditDescription(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                        placeholder="Descricao do plano"
                      />
                    </div>

                    {/* Features */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Beneficios do plano</label>
                      <div className="space-y-1.5 mb-3">
                        {editFeatures.map((feat, i) => (
                          <div key={i} className="flex items-center gap-2 bg-slate-50/80 rounded-lg px-3 py-2 border border-slate-100 group">
                            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                            <span className="flex-1 text-sm text-slate-700">{feat}</span>
                            <button
                              onClick={() => removeFeature(i)}
                              className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newFeature}
                          onChange={e => setNewFeature(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeature(); } }}
                          className="flex-1 px-3 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                          placeholder="Adicionar beneficio..."
                        />
                        <button
                          onClick={addFeature}
                          disabled={!newFeature.trim()}
                          className="px-3 py-2.5 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200/50 hover:bg-blue-100 disabled:opacity-40 transition-all flex items-center gap-1"
                        >
                          <Plus size={13} />
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {plan.description && (
                      <p className="text-sm text-slate-500 mb-3">{plan.description}</p>
                    )}
                    {Array.isArray(plan.features) && plan.features.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {plan.features.map((feat, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-100"
                          >
                            <CheckCircle2 size={11} className="text-emerald-500" />
                            {feat}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Just saved indicator */}
                    {justSaved && (
                      <div className="mt-3 flex items-center gap-2 text-emerald-600 text-xs font-semibold animate-fade-in">
                        <CheckCircle2 size={14} />
                        Plano atualizado com sucesso!
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
