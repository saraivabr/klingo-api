import React, { useEffect, useState } from 'react';
import {
  MessageCircle, Brain, Shield, CreditCard, Calendar,
  RefreshCw, CheckCircle2, AlertCircle, XCircle, Loader2,
  Zap, Users, Stethoscope, ChevronDown, ChevronRight,
  Database, Wifi, WifiOff, Activity, ExternalLink,
  Bot, BookOpen, DollarSign,
} from 'lucide-react';
import { api } from '../services/api';

/* ── types ─────────────────────────────────── */

interface HubStatus {
  whatsapp: { connected: boolean; status: string; provider: string; url?: string };
  klingo: { connected: boolean; lastSync?: string; lastSuccess?: boolean; lastError?: string; itemsSyncedToday?: number };
  igs: { connected: boolean; productsCount?: number; error?: string };
  asaas: { connected: boolean; environment?: string };
  ai: { connected: boolean; model?: string };
  redis: { connected: boolean };
}

interface AIConfig {
  knowledgeBase: { key: string; question: string; answer: string; category: string }[];
  services: { id: string; name: string; category: string; priceCents: number; isActive: boolean }[];
  doctors: { id: string; name: string; specialty: string; isActive: boolean; klingoId?: number }[];
  subscriptionStats: { total: number; active: number; pending: number; cancelled: number };
}

/* ── component ─────────────────────────────── */

export default function Hub() {
  const [status, setStatus] = useState<HubStatus | null>(null);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getHubStatus(),
      api.getHubAIConfig(),
    ]).then(([s, c]) => {
      setStatus(s as unknown as HubStatus);
      setAiConfig(c as AIConfig);
    }).catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleKlingoSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await api.triggerKlingoSync();
      setSyncResult(result.success ? 'Sincronizacao concluida com sucesso!' : 'Falha na sincronizacao');
      loadData();
    } catch (err: any) {
      setSyncResult('Erro: ' + (err.message || 'falha'));
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-emerald-500" />
          <p className="text-sm text-slate-400">Verificando conexoes...</p>
        </div>
      </div>
    );
  }

  const connections = status ? [
    {
      key: 'whatsapp',
      icon: MessageCircle,
      name: 'WhatsApp',
      description: 'Conexao com UAZAPI para envio e recebimento de mensagens',
      connected: status.whatsapp.connected,
      statusLabel: status.whatsapp.status === 'open' ? 'Conectado' : status.whatsapp.status === 'close' ? 'Desconectado' : status.whatsapp.status,
      gradient: 'from-green-500 to-emerald-600',
      details: [
        { label: 'Provedor', value: status.whatsapp.provider },
        ...(status.whatsapp.url ? [{ label: 'URL', value: status.whatsapp.url }] : []),
      ],
    },
    {
      key: 'ai',
      icon: Brain,
      name: 'IA (Claude)',
      description: 'Inteligencia artificial para atendimento automatico via WhatsApp',
      connected: status.ai.connected,
      statusLabel: status.ai.connected ? 'Ativo' : 'Sem API Key',
      gradient: 'from-violet-500 to-purple-600',
      details: [
        { label: 'Modelo', value: status.ai.model || '—' },
        ...(aiConfig ? [{ label: 'Base de conhecimento', value: `${aiConfig.knowledgeBase.length} respostas` }] : []),
        ...(aiConfig ? [{ label: 'Servicos cadastrados', value: `${aiConfig.services.filter(s => s.isActive).length} ativos` }] : []),
      ],
    },
    {
      key: 'klingo',
      icon: Calendar,
      name: 'Klingo',
      description: 'Sistema de gestao clinica — agendas, pacientes, medicos',
      connected: status.klingo.connected,
      statusLabel: status.klingo.connected ? 'Conectado' : 'Erro',
      gradient: 'from-blue-500 to-indigo-600',
      details: [
        { label: 'Ultima sync', value: status.klingo.lastSync ? new Date(status.klingo.lastSync).toLocaleString('pt-BR') : 'Nunca' },
        { label: 'Itens sincronizados hoje', value: `${status.klingo.itemsSyncedToday || 0}` },
        ...(status.klingo.lastError ? [{ label: 'Ultimo erro', value: status.klingo.lastError }] : []),
        ...(aiConfig ? [{ label: 'Medicos sincronizados', value: `${aiConfig.doctors.length}` }] : []),
      ],
      action: {
        label: syncing ? 'Sincronizando...' : 'Sincronizar Agendas',
        icon: RefreshCw,
        onClick: handleKlingoSync,
        loading: syncing,
      },
    },
    {
      key: 'igs',
      icon: Shield,
      name: 'IGS Assistencias',
      description: 'Plataforma de beneficios e assistencias para assinantes',
      connected: status.igs.connected,
      statusLabel: status.igs.connected ? 'Conectado' : 'Erro',
      gradient: 'from-cyan-500 to-teal-600',
      details: [
        { label: 'Produtos disponiveis', value: `${status.igs.productsCount || 0}` },
        ...(status.igs.error ? [{ label: 'Erro', value: status.igs.error }] : []),
      ],
    },
    {
      key: 'asaas',
      icon: CreditCard,
      name: 'Asaas',
      description: 'Gateway de pagamento — PIX, boleto, cartao de credito',
      connected: status.asaas.connected,
      statusLabel: status.asaas.connected ? 'Ativo' : 'Nao configurado',
      gradient: 'from-amber-500 to-orange-600',
      details: [
        { label: 'Ambiente', value: status.asaas.environment === 'production' ? 'Producao' : 'Sandbox' },
        ...(aiConfig ? [{ label: 'Assinaturas ativas', value: `${aiConfig.subscriptionStats.active}` }] : []),
      ],
    },
    {
      key: 'redis',
      icon: Database,
      name: 'Redis',
      description: 'Cache e fila de processamento de mensagens',
      connected: status.redis.connected,
      statusLabel: status.redis.connected ? 'Conectado' : 'Offline',
      gradient: 'from-red-500 to-rose-600',
      details: [],
    },
  ] : [];

  const activeServices = aiConfig?.services.filter(s => s.isActive) || [];
  const categories = [...new Set(activeServices.map(s => s.category))];
  const activeDoctors = aiConfig?.doctors.filter(d => d.isActive) || [];
  const kbCategories = [...new Set((aiConfig?.knowledgeBase || []).map(k => k.category))];

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Zap size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Hub de Conexoes</h1>
            <p className="text-sm text-slate-500">Status de todas as integracoes e configuracoes da IA</p>
          </div>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
        >
          <RefreshCw size={14} />
          Atualizar
        </button>
      </div>

      {/* Sync result toast */}
      {syncResult && (
        <div className={`mb-6 flex items-center gap-2.5 text-sm px-4 py-3 rounded-xl border animate-slide-up ${
          syncResult.includes('sucesso') ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' : 'bg-rose-50 text-rose-700 border-rose-200/50'
        }`}>
          {syncResult.includes('sucesso') ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {syncResult}
        </div>
      )}

      {/* Connection Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {connections.map(conn => {
          const Icon = conn.icon;
          const isExpanded = expandedSection === conn.key;

          return (
            <div
              key={conn.key}
              className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden hover:shadow-md hover:border-slate-300/60 transition-all duration-200"
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${conn.gradient} flex items-center justify-center shadow-lg shadow-slate-300/20`}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    conn.connected
                      ? 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/20'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${conn.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                    {conn.statusLabel}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-sm">{conn.name}</h3>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{conn.description}</p>

                {/* Details */}
                {conn.details.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {conn.details.map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">{d.label}</span>
                        <span className="font-medium text-slate-700 text-right max-w-[60%] truncate">{d.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action button */}
                {conn.action && (
                  <button
                    onClick={conn.action.onClick}
                    disabled={conn.action.loading}
                    className="w-full mt-4 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200/50 hover:bg-blue-100 disabled:opacity-50 transition-all"
                  >
                    {conn.action.loading ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <conn.action.icon size={13} className={conn.action.loading ? 'animate-spin' : ''} />
                    )}
                    {conn.action.label}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Configuration Section */}
      {aiConfig && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Bot size={20} className="text-violet-600" />
            <h2 className="text-lg font-bold text-slate-900">Configuracao da IA</h2>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Medicos" value={activeDoctors.length.toString()} sub="com agenda ativa" icon={Stethoscope} color="blue" />
            <StatCard label="Servicos" value={activeServices.length.toString()} sub={`em ${categories.length} categorias`} icon={Activity} color="emerald" />
            <StatCard label="Base de Conhecimento" value={aiConfig.knowledgeBase.length.toString()} sub={`${kbCategories.length} categorias`} icon={BookOpen} color="violet" />
            <StatCard label="Assinaturas" value={aiConfig.subscriptionStats.active.toString()} sub={`de ${aiConfig.subscriptionStats.total} total`} icon={Users} color="amber" />
          </div>

          {/* Collapsible sections */}
          <CollapsibleSection
            title="Medicos e Agendas"
            subtitle={`${activeDoctors.length} medicos ativos`}
            icon={Stethoscope}
            expanded={expandedSection === 'doctors'}
            onToggle={() => setExpandedSection(expandedSection === 'doctors' ? null : 'doctors')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {activeDoctors.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 bg-slate-50/80 rounded-xl px-4 py-3 border border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <Stethoscope size={14} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{doc.name}</p>
                    <p className="text-[10px] text-slate-400">{doc.specialty}{doc.klingoId ? ` · Klingo #${doc.klingoId}` : ''}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">
                    <span className="w-1 h-1 rounded-full bg-emerald-500" />
                    Ativo
                  </span>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Servicos e Precos"
            subtitle={`${activeServices.length} servicos ativos`}
            icon={DollarSign}
            expanded={expandedSection === 'services'}
            onToggle={() => setExpandedSection(expandedSection === 'services' ? null : 'services')}
          >
            <div className="space-y-3">
              {categories.map(cat => (
                <div key={cat}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{cat}</p>
                  <div className="space-y-1">
                    {activeServices.filter(s => s.category === cat).map(svc => (
                      <div key={svc.id} className="flex items-center justify-between bg-slate-50/80 rounded-lg px-4 py-2.5 border border-slate-100">
                        <span className="text-sm text-slate-800">{svc.name}</span>
                        <span className="text-sm font-bold text-emerald-700 tabular-nums">
                          {svc.priceCents ? `R$ ${(svc.priceCents / 100).toFixed(2)}` : 'Consultar'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title="Base de Conhecimento da IA"
            subtitle={`${aiConfig.knowledgeBase.length} respostas programadas`}
            icon={BookOpen}
            expanded={expandedSection === 'kb'}
            onToggle={() => setExpandedSection(expandedSection === 'kb' ? null : 'kb')}
          >
            <div className="space-y-3">
              {kbCategories.map(cat => (
                <div key={cat}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{cat}</p>
                  <div className="space-y-1.5">
                    {aiConfig.knowledgeBase.filter(k => k.category === cat).map(kb => (
                      <div key={kb.key} className="bg-slate-50/80 rounded-lg px-4 py-3 border border-slate-100">
                        <p className="text-xs font-semibold text-slate-700 mb-1">{kb.question}</p>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{kb.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub: string; icon: React.ElementType; color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  };
  return (
    <div className={`rounded-2xl p-4 border ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} />
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>
    </div>
  );
}

function CollapsibleSection({ title, subtitle, icon: Icon, expanded, onToggle, children }: {
  title: string; subtitle: string; icon: React.ElementType; expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <Icon size={16} className="text-slate-600" />
          </div>
          <div className="text-left">
            <span className="font-semibold text-sm text-slate-900">{title}</span>
            <p className="text-[11px] text-slate-400">{subtitle}</p>
          </div>
        </div>
        {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
      </button>
      {expanded && (
        <div className="px-5 pb-5 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}
