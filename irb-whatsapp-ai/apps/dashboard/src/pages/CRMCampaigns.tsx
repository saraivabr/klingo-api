import React, { useEffect, useState } from 'react';
import {
  Edit3,
  Megaphone,
  Pause,
  Play,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { api } from '../services/api';

/* ───────────────── types ───────────────── */

interface Campaign {
  id: string;
  name: string;
  code: string;
  channel: string;
  medium?: string;
  landingPage?: string;
  budget?: number;
  startDate?: string;
  endDate?: string;
  status: string;
  leadCount?: number;
  createdAt: string;
}

/* ───────────────── helpers ───────────────── */

const CHANNEL_BADGE: Record<string, { label: string; className: string }> = {
  google: { label: 'Google', className: 'bg-blue-50 text-blue-700 ring-blue-200' },
  meta: { label: 'Meta', className: 'bg-purple-50 text-purple-700 ring-purple-200' },
  site: { label: 'Site', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  email: { label: 'E-mail', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  outro: { label: 'Outro', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  active: { label: 'Ativa', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  paused: { label: 'Pausada', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  ended: { label: 'Encerrada', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

function formatCurrency(cents: number) {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

const INPUT_CLASS =
  'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white';

/* ───────────────── component ───────────────── */

export default function CRMCampaigns() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [search, setSearch] = useState('');

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    name: '',
    code: '',
    channel: 'google',
    medium: '',
    landingPage: '',
    budget: '',
    startDate: '',
    endDate: '',
  });

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const res = await api.getCRMCampaigns();
      setCampaigns(res.campaigns || []);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const filtered = campaigns.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', code: '', channel: 'google', medium: '', landingPage: '', budget: '', startDate: '', endDate: '' });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (c: Campaign) => {
    setEditingId(c.id);
    setForm({
      name: c.name,
      code: c.code,
      channel: c.channel,
      medium: c.medium || '',
      landingPage: c.landingPage || '',
      budget: c.budget ? String(c.budget / 100) : '',
      startDate: c.startDate ? c.startDate.split('T')[0] : '',
      endDate: c.endDate ? c.endDate.split('T')[0] : '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      setFormError('Nome e codigo sao obrigatorios.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        channel: form.channel,
        medium: form.medium.trim() || undefined,
        landingPage: form.landingPage.trim() || undefined,
        budget: form.budget ? Math.round(Number(form.budget.replace(',', '.')) * 100) : undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      };
      if (editingId) {
        await api.updateCRMCampaign(editingId, payload);
      } else {
        await api.createCRMCampaign(payload);
      }
      setModalOpen(false);
      await loadCampaigns();
    } catch (err: any) {
      setFormError(err.message || 'Falha ao salvar campanha');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (c: Campaign) => {
    const newStatus = c.status === 'active' ? 'paused' : c.status === 'paused' ? 'active' : c.status;
    if (newStatus === c.status) return;
    await api.updateCRMCampaign(c.id, { status: newStatus });
    await loadCampaigns();
  };

  return (
    <div className="space-y-6 px-6 py-6">
      {/* hero */}
      <section className="overflow-hidden rounded-[28px] border border-slate-900 bg-slate-950 text-white shadow-2xl shadow-slate-950/15">
        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.35fr_0.95fr] lg:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-purple-300/80">CRM - Campanhas</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">Gerencie as campanhas de captacao de leads.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Crie, edite e acompanhe o desempenho das campanhas vinculadas ao funil de vendas.
            </p>
          </div>
          <div className="flex items-end justify-end">
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-purple-50"
            >
              <Plus size={16} />
              Nova campanha
            </button>
          </div>
        </div>
      </section>

      {/* filter bar */}
      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou codigo"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 outline-none transition focus:border-slate-400"
            />
          </div>
        </div>

        {/* table */}
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 text-slate-500">
              <tr>
                <th className="px-3 py-3 text-left font-medium">Campanha</th>
                <th className="px-3 py-3 text-left font-medium">Codigo</th>
                <th className="px-3 py-3 text-left font-medium">Canal</th>
                <th className="px-3 py-3 text-left font-medium">Status</th>
                <th className="px-3 py-3 text-right font-medium">Leads</th>
                <th className="px-3 py-3 text-right font-medium">Orcamento</th>
                <th className="px-3 py-3 text-left font-medium">Periodo</th>
                <th className="px-3 py-3 text-right font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => {
                const channelBadge = CHANNEL_BADGE[c.channel] || CHANNEL_BADGE.outro;
                const statusBadge = STATUS_META[c.status] || STATUS_META.ended;
                return (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-4">
                      <p className="font-medium text-slate-900">{c.name}</p>
                      {c.medium && <p className="mt-0.5 text-xs text-slate-500">{c.medium}</p>}
                    </td>
                    <td className="px-3 py-4 font-mono text-xs text-slate-600">{c.code}</td>
                    <td className="px-3 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${channelBadge.className}`}>
                        {channelBadge.label}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusBadge.className}`}>
                        {statusBadge.label}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-right font-medium text-slate-900">{c.leadCount ?? 0}</td>
                    <td className="px-3 py-4 text-right text-slate-600">
                      {c.budget ? formatCurrency(c.budget) : '-'}
                    </td>
                    <td className="px-3 py-4 text-slate-600">
                      {c.startDate ? formatDate(c.startDate) : '-'}
                      {c.endDate ? ` a ${formatDate(c.endDate)}` : ''}
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(c)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-slate-600 hover:text-slate-900"
                          title="Editar"
                        >
                          <Edit3 size={15} />
                        </button>
                        {(c.status === 'active' || c.status === 'paused') && (
                          <button
                            onClick={() => toggleStatus(c)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-2 text-slate-600 hover:text-slate-900"
                            title={c.status === 'active' ? 'Pausar' : 'Ativar'}
                          >
                            {c.status === 'active' ? <Pause size={15} /> : <Play size={15} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm text-slate-500">
                    Nenhuma campanha encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* create / edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {editingId ? 'Editar campanha' : 'Nova campanha'}
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {editingId ? 'Atualizar dados da campanha' : 'Criar campanha de captacao'}
                </h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
                <X size={16} />
              </button>
            </div>

            {formError && (
              <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {formError}
              </div>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Nome *</span>
                <input value={form.name} onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))} className={INPUT_CLASS} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Codigo (UTM) *</span>
                <input value={form.code} onChange={(e) => setForm((c) => ({ ...c, code: e.target.value }))} className={INPUT_CLASS} placeholder="ex: google_brand_mar25" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Canal</span>
                <select value={form.channel} onChange={(e) => setForm((c) => ({ ...c, channel: e.target.value }))} className={INPUT_CLASS}>
                  <option value="google">Google</option>
                  <option value="meta">Meta</option>
                  <option value="site">Site</option>
                  <option value="email">E-mail</option>
                  <option value="outro">Outro</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Midia</span>
                <input value={form.medium} onChange={(e) => setForm((c) => ({ ...c, medium: e.target.value }))} className={INPUT_CLASS} placeholder="cpc, social, organic" />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Landing page</span>
                <input value={form.landingPage} onChange={(e) => setForm((c) => ({ ...c, landingPage: e.target.value }))} className={INPUT_CLASS} placeholder="https://..." />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Orcamento (R$)</span>
                <input type="number" min="0" step="0.01" value={form.budget} onChange={(e) => setForm((c) => ({ ...c, budget: e.target.value }))} className={INPUT_CLASS} />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-600">Inicio</span>
                  <input type="date" value={form.startDate} onChange={(e) => setForm((c) => ({ ...c, startDate: e.target.value }))} className={INPUT_CLASS} />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-600">Fim</span>
                  <input type="date" value={form.endDate} onChange={(e) => setForm((c) => ({ ...c, endDate: e.target.value }))} className={INPUT_CLASS} />
                </label>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <Megaphone size={16} />
                {saving ? 'Salvando...' : editingId ? 'Salvar alteracoes' : 'Criar campanha'}
              </button>
              <button onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
