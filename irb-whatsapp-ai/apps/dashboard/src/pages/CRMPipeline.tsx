import React, { useEffect, useState, useRef } from 'react';
import {
  ChevronDown,
  Clock3,
  GripVertical,
  Megaphone,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Trophy,
  User,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import { api } from '../services/api';

/* ───────────────── types ───────────────── */

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  color?: string;
}

interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: string;
  campaignName?: string;
  campaignId?: string;
  stageId: string;
  stageName?: string;
  assignedTo?: string;
  assignedToName?: string;
  interest?: string;
  value?: number;
  firstMessage?: string;
  createdAt: string;
  updatedAt: string;
  activities?: Activity[];
  wonAt?: string;
  lostAt?: string;
  lostReason?: string;
}

interface Activity {
  id: string;
  type: string;
  description: string;
  createdBy?: string;
  createdAt: string;
}

interface Campaign {
  id: string;
  name: string;
}

/* ───────────────── helpers ───────────────── */

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  google_ads: { label: 'Google', className: 'bg-blue-50 text-blue-700 ring-blue-200' },
  meta_ads: { label: 'Meta', className: 'bg-purple-50 text-purple-700 ring-purple-200' },
  site: { label: 'Site', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  organico: { label: 'Organico', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `ha ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `ha ${hours}h`;
  const days = Math.floor(hours / 24);
  return `ha ${days}d`;
}

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

export default function CRMPipeline() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');

  // modals
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  // create form
  const [createForm, setCreateForm] = useState({ name: '', phone: '', email: '', source: 'organico', interest: '' });
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState('');

  // detail form
  const [detailStageId, setDetailStageId] = useState('');
  const [detailAssignedTo, setDetailAssignedTo] = useState('');
  const [detailValue, setDetailValue] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  // drag and drop
  const dragItem = useRef<string | null>(null);
  const dragOverStage = useRef<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (sourceFilter) params.source = sourceFilter;
      if (campaignFilter) params.campaignId = campaignFilter;

      const [stagesRes, leadsRes, campaignsRes] = await Promise.all([
        api.getCRMPipelineStages(),
        api.getCRMLeads(params),
        api.getCRMCampaigns(),
      ]);
      setStages(stagesRes.stages || []);
      setLeads(leadsRes.leads || []);
      setCampaigns(campaignsRes.campaigns || []);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, sourceFilter, campaignFilter]);

  const leadsForStage = (stageId: string) =>
    leads.filter((l) => l.stageId === stageId);

  /* ── drag handlers ── */
  const onDragStart = (leadId: string) => {
    dragItem.current = leadId;
  };

  const onDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    dragOverStage.current = stageId;
  };

  const onDrop = async (stageId: string) => {
    const leadId = dragItem.current;
    if (!leadId) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stageId === stageId) return;

    // optimistic update
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stageId } : l)));
    try {
      await api.moveCRMLeadStage(leadId, stageId);
    } catch {
      await loadData();
    }
    dragItem.current = null;
    dragOverStage.current = null;
  };

  /* ── open detail ── */
  const openDetail = async (lead: Lead) => {
    try {
      const full = await api.getCRMLead(lead.id);
      setSelectedLead(full);
      setDetailStageId(full.stageId || '');
      setDetailAssignedTo(full.assignedTo || '');
      setDetailValue(full.value ? String(full.value / 100) : '');
      setDetailOpen(true);
    } catch {
      setSelectedLead(lead);
      setDetailStageId(lead.stageId || '');
      setDetailAssignedTo(lead.assignedTo || '');
      setDetailValue(lead.value ? String(lead.value / 100) : '');
      setDetailOpen(true);
    }
  };

  /* ── detail actions ── */
  const handleStageChange = async (newStageId: string) => {
    if (!selectedLead) return;
    setDetailStageId(newStageId);
    await api.moveCRMLeadStage(selectedLead.id, newStageId);
    setLeads((prev) => prev.map((l) => (l.id === selectedLead.id ? { ...l, stageId: newStageId } : l)));
  };

  const handleSaveDetail = async () => {
    if (!selectedLead) return;
    await api.updateCRMLead(selectedLead.id, {
      assignedTo: detailAssignedTo || undefined,
      value: detailValue ? Math.round(Number(detailValue.replace(',', '.')) * 100) : undefined,
    });
    await loadData();
  };

  const handleAddNote = async () => {
    if (!selectedLead || !noteText.trim()) return;
    setNoteSaving(true);
    try {
      await api.addCRMLeadActivity(selectedLead.id, { type: 'note', description: noteText.trim() });
      setNoteText('');
      const full = await api.getCRMLead(selectedLead.id);
      setSelectedLead(full);
    } finally {
      setNoteSaving(false);
    }
  };

  const handleConvert = async () => {
    if (!selectedLead) return;
    if (!window.confirm('Converter este lead em paciente?')) return;
    await api.convertCRMLead(selectedLead.id);
    setDetailOpen(false);
    await loadData();
  };

  const handleCloseWon = async () => {
    if (!selectedLead) return;
    await api.closeCRMLead(selectedLead.id, { outcome: 'won' });
    setDetailOpen(false);
    await loadData();
  };

  const handleCloseLost = async () => {
    if (!selectedLead) return;
    const reason = window.prompt('Motivo da perda:');
    if (reason === null) return;
    await api.closeCRMLead(selectedLead.id, { outcome: 'lost', reason });
    setDetailOpen(false);
    await loadData();
  };

  /* ── create ── */
  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.phone.trim()) {
      setCreateError('Nome e telefone sao obrigatorios.');
      return;
    }
    setCreateSaving(true);
    setCreateError('');
    try {
      await api.createCRMLead({
        name: createForm.name.trim(),
        phone: createForm.phone.trim(),
        email: createForm.email.trim() || undefined,
        source: createForm.source,
        interest: createForm.interest.trim() || undefined,
      });
      setCreateOpen(false);
      setCreateForm({ name: '', phone: '', email: '', source: 'organico', interest: '' });
      await loadData();
    } catch (err: any) {
      setCreateError(err.message || 'Falha ao criar lead');
    } finally {
      setCreateSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* ── top bar ── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 outline-none transition focus:border-slate-400"
          />
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
        >
          <option value="">Todas as origens</option>
          <option value="google_ads">Google Ads</option>
          <option value="meta_ads">Meta Ads</option>
          <option value="site">Site</option>
          <option value="organico">Organico</option>
        </select>
        <select
          value={campaignFilter}
          onChange={(e) => setCampaignFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
        >
          <option value="">Todas as campanhas</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setCreateError('');
            setCreateOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Plus size={16} />
          Novo Lead
        </button>
      </div>

      {/* ── kanban board ── */}
      <div className="flex-1 overflow-x-auto p-4">
        {loading && stages.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-sm text-slate-500">Carregando pipeline...</div>
        ) : (
          <div className="flex gap-4" style={{ minWidth: stages.length * 300 }}>
            {stages
              .sort((a, b) => a.order - b.order)
              .map((stage) => {
                const stageLeads = leadsForStage(stage.id);
                return (
                  <div
                    key={stage.id}
                    className="flex w-[290px] shrink-0 flex-col rounded-2xl border border-slate-200 bg-slate-50/80"
                    onDragOver={(e) => onDragOver(e, stage.id)}
                    onDrop={() => onDrop(stage.id)}
                  >
                    {/* column header */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: stage.color || '#94a3b8' }}
                        />
                        <h3 className="text-sm font-semibold text-slate-900">{stage.name}</h3>
                      </div>
                      <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-slate-200 px-2 text-xs font-semibold text-slate-600">
                        {stageLeads.length}
                      </span>
                    </div>

                    {/* cards */}
                    <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3" style={{ maxHeight: 'calc(100vh - 220px)' }}>
                      {stageLeads.map((lead) => {
                        const badge = SOURCE_BADGE[lead.source] || SOURCE_BADGE.organico;
                        return (
                          <div
                            key={lead.id}
                            draggable
                            onDragStart={() => onDragStart(lead.id)}
                            onClick={() => openDetail(lead)}
                            className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-900">{lead.name}</p>
                              <GripVertical size={14} className="mt-0.5 shrink-0 text-slate-300" />
                            </div>
                            <p className="mt-1 text-xs text-slate-500">{lead.phone}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                              {lead.campaignName && (
                                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                  <Megaphone size={10} />
                                  {lead.campaignName}
                                </span>
                              )}
                            </div>
                            {lead.interest && (
                              <p className="mt-2 text-xs text-slate-500 line-clamp-1">{lead.interest}</p>
                            )}
                            <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                              <Clock3 size={10} />
                              {timeAgo(lead.createdAt)}
                            </p>
                          </div>
                        );
                      })}
                      {stageLeads.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                          Nenhum lead
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* ── detail modal ── */}
      {detailOpen && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 pt-12">
          <div className="w-full max-w-3xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Detalhe do Lead</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{selectedLead.name}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                  <span className="flex items-center gap-1"><Phone size={14} />{selectedLead.phone}</span>
                  {selectedLead.email && <span>{selectedLead.email}</span>}
                </div>
              </div>
              <button onClick={() => setDetailOpen(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
                <X size={16} />
              </button>
            </div>

            {/* info grid */}
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Origem</p>
                <div className="mt-2">
                  {(() => {
                    const badge = SOURCE_BADGE[selectedLead.source] || SOURCE_BADGE.organico;
                    return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${badge.className}`}>{badge.label}</span>;
                  })()}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Campanha</p>
                <p className="mt-2 text-sm text-slate-700">{selectedLead.campaignName || '-'}</p>
              </div>
            </div>

            {selectedLead.firstMessage && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Primeira mensagem</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{selectedLead.firstMessage}</p>
              </div>
            )}

            {/* edit fields */}
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Etapa</span>
                <select
                  value={detailStageId}
                  onChange={(e) => handleStageChange(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Responsavel</span>
                <input
                  value={detailAssignedTo}
                  onChange={(e) => setDetailAssignedTo(e.target.value)}
                  placeholder="Nome ou ID"
                  className={INPUT_CLASS}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Valor (R$)</span>
                <input
                  value={detailValue}
                  onChange={(e) => setDetailValue(e.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  className={INPUT_CLASS}
                />
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleSaveDetail}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Salvar alteracoes
              </button>
            </div>

            {/* activity timeline */}
            <div className="mt-6">
              <p className="text-sm font-semibold text-slate-900">Atividades</p>
              <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
                {(selectedLead.activities || []).map((act) => (
                  <div key={act.id} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <MessageSquare size={14} className="mt-0.5 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700">{act.description}</p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {act.createdBy ? `${act.createdBy} - ` : ''}{formatDate(act.createdAt)} {timeAgo(act.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
                {(!selectedLead.activities || selectedLead.activities.length === 0) && (
                  <p className="text-sm text-slate-400">Nenhuma atividade registrada.</p>
                )}
              </div>
            </div>

            {/* add note */}
            <div className="mt-4 flex gap-2">
              <input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Adicionar nota..."
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
              />
              <button
                onClick={handleAddNote}
                disabled={noteSaving || !noteText.trim()}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {noteSaving ? '...' : 'Adicionar'}
              </button>
            </div>

            {/* action buttons */}
            <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-5">
              <button
                onClick={handleConvert}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <UserPlus size={16} />
                Converter em paciente
              </button>
              <button
                onClick={handleCloseWon}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white hover:bg-sky-700"
              >
                <Trophy size={16} />
                Ganho
              </button>
              <button
                onClick={handleCloseLost}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:text-rose-700"
              >
                <XCircle size={16} />
                Perdido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── create modal ── */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Novo Lead</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Adicionar lead manualmente</h3>
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

            <div className="mt-6 grid gap-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Nome *</span>
                <input value={createForm.name} onChange={(e) => setCreateForm((c) => ({ ...c, name: e.target.value }))} className={INPUT_CLASS} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Telefone *</span>
                <input value={createForm.phone} onChange={(e) => setCreateForm((c) => ({ ...c, phone: e.target.value }))} className={INPUT_CLASS} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">E-mail</span>
                <input value={createForm.email} onChange={(e) => setCreateForm((c) => ({ ...c, email: e.target.value }))} className={INPUT_CLASS} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Origem</span>
                <select value={createForm.source} onChange={(e) => setCreateForm((c) => ({ ...c, source: e.target.value }))} className={INPUT_CLASS}>
                  <option value="organico">Organico</option>
                  <option value="google_ads">Google Ads</option>
                  <option value="meta_ads">Meta Ads</option>
                  <option value="site">Site</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-600">Interesse</span>
                <input value={createForm.interest} onChange={(e) => setCreateForm((c) => ({ ...c, interest: e.target.value }))} className={INPUT_CLASS} />
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleCreate}
                disabled={createSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <Plus size={16} />
                {createSaving ? 'Salvando...' : 'Criar lead'}
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
