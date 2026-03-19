import React, { useEffect, useState } from 'react';
import { BarChart3, Target, TrendingUp, Users } from 'lucide-react';
import { api } from '../services/api';

/* ───────────────── types ───────────────── */

interface Metrics {
  totalLeadsMonth: number;
  conversionRate: number;
  avgDealValue: number;
  leadsToday: number;
  bySource: Record<string, number>;
  byCampaign: Array<{ name: string; count: number }>;
  funnel: Array<{ stageId: string; stageName: string; count: number; percent: number }>;
}

interface RecentLead {
  id: string;
  name: string;
  phone: string;
  source: string;
  stageName: string;
  createdAt: string;
}

/* ───────────────── helpers ───────────────── */

const SOURCE_COLORS: Record<string, string> = {
  google_ads: '#3b82f6',
  meta_ads: '#a855f7',
  site: '#10b981',
  organico: '#94a3b8',
};

const SOURCE_LABELS: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  site: 'Site',
  organico: 'Organico',
};

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  google_ads: { label: 'Google', className: 'bg-blue-50 text-blue-700 ring-blue-200' },
  meta_ads: { label: 'Meta', className: 'bg-purple-50 text-purple-700 ring-purple-200' },
  site: { label: 'Site', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  organico: { label: 'Organico', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

function formatCurrency(cents: number) {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

/* ───────────────── sub-components ───────────────── */

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
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

/* ───────────────── main component ───────────────── */

export default function CRMMetrics() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [metricsRes, leadsRes] = await Promise.all([
          api.getCRMMetrics(),
          api.getCRMLeads({ limit: '10', sort: 'recent' }),
        ]);
        setMetrics(metricsRes);
        setRecentLeads(leadsRes.leads || []);
      } catch {
        // silently handle
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const bySource = metrics?.bySource || {};
  const totalBySource = Object.values(bySource).reduce((s, v) => s + v, 0) || 1;
  const byCampaign = metrics?.byCampaign || [];
  const maxCampaignCount = Math.max(...byCampaign.map((c) => c.count), 1);
  const funnel = metrics?.funnel || [];

  return (
    <div className="space-y-6 px-6 py-6">
      {/* hero */}
      <section className="overflow-hidden rounded-[28px] border border-slate-900 bg-slate-950 text-white shadow-2xl shadow-slate-950/15">
        <div className="px-6 py-6 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-300/80">CRM - Metricas</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">Panorama do funil de vendas</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Acompanhe a entrada de leads, taxa de conversao e desempenho das campanhas em tempo real.
          </p>
        </div>
      </section>

      {/* stat cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          eyebrow="Leads no Mes"
          value={String(metrics?.totalLeadsMonth || 0)}
          support="Total de leads captados no periodo."
          tone="text-slate-900"
        />
        <StatCard
          icon={Target}
          eyebrow="Taxa de Conversao"
          value={`${(metrics?.conversionRate || 0).toFixed(1)}%`}
          support="Leads convertidos em pacientes."
          tone="text-emerald-600"
        />
        <StatCard
          icon={TrendingUp}
          eyebrow="Ticket Medio"
          value={formatCurrency(metrics?.avgDealValue || 0)}
          support="Valor medio dos leads ganhos."
          tone="text-sky-600"
        />
        <StatCard
          icon={BarChart3}
          eyebrow="Leads Hoje"
          value={String(metrics?.leadsToday || 0)}
          support="Novos leads captados hoje."
          tone="text-amber-600"
        />
      </section>

      {/* charts row */}
      <section className="grid gap-6 xl:grid-cols-2">
        {/* by source - donut */}
        <Surface title="Leads por origem" subtitle="Distribuicao das fontes de captacao.">
          <div className="flex items-center gap-8">
            {/* CSS donut */}
            <div className="relative h-40 w-40 shrink-0">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                {(() => {
                  let offset = 0;
                  const entries = Object.entries(bySource);
                  return entries.map(([source, count]) => {
                    const pct = (count / totalBySource) * 100;
                    const stroke = SOURCE_COLORS[source] || '#94a3b8';
                    const el = (
                      <circle
                        key={source}
                        cx="18"
                        cy="18"
                        r="15.9155"
                        fill="none"
                        stroke={stroke}
                        strokeWidth="3.5"
                        strokeDasharray={`${pct} ${100 - pct}`}
                        strokeDashoffset={`${-offset}`}
                        className="transition-all duration-500"
                      />
                    );
                    offset += pct;
                    return el;
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-semibold text-slate-900">{totalBySource}</span>
              </div>
            </div>
            {/* legend */}
            <div className="space-y-2">
              {Object.entries(bySource).map(([source, count]) => (
                <div key={source} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: SOURCE_COLORS[source] || '#94a3b8' }} />
                  <span className="text-sm text-slate-700">{SOURCE_LABELS[source] || source}</span>
                  <span className="ml-auto text-sm font-semibold text-slate-900">{count}</span>
                  <span className="text-xs text-slate-400">({((count / totalBySource) * 100).toFixed(0)}%)</span>
                </div>
              ))}
            </div>
          </div>
        </Surface>

        {/* by campaign - horizontal bars */}
        <Surface title="Leads por campanha" subtitle="Performance de cada campanha ativa.">
          <div className="space-y-3">
            {byCampaign.length === 0 && (
              <p className="text-sm text-slate-400">Nenhuma campanha com leads.</p>
            )}
            {byCampaign.map((c) => (
              <div key={c.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-slate-700">{c.name}</span>
                  <span className="font-semibold text-slate-900">{c.count}</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all duration-500"
                    style={{ width: `${(c.count / maxCampaignCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Surface>
      </section>

      {/* tables row */}
      <section className="grid gap-6 xl:grid-cols-2">
        {/* funnel */}
        <Surface title="Funil do pipeline" subtitle="Distribuicao por etapa.">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 text-slate-500">
              <tr>
                <th className="px-3 py-3 text-left font-medium">Etapa</th>
                <th className="px-3 py-3 text-right font-medium">Leads</th>
                <th className="px-3 py-3 text-right font-medium">% do total</th>
                <th className="px-3 py-3 text-left font-medium" style={{ width: '40%' }}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {funnel.map((row) => (
                <tr key={row.stageId} className="hover:bg-slate-50/80">
                  <td className="px-3 py-3 font-medium text-slate-900">{row.stageName}</td>
                  <td className="px-3 py-3 text-right text-slate-700">{row.count}</td>
                  <td className="px-3 py-3 text-right text-slate-700">{row.percent.toFixed(1)}%</td>
                  <td className="px-3 py-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-400 transition-all duration-500"
                        style={{ width: `${row.percent}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {funnel.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                    Sem dados de funil.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Surface>

        {/* recent leads */}
        <Surface title="Leads recentes" subtitle="Ultimos 10 leads captados.">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 text-slate-500">
              <tr>
                <th className="px-3 py-3 text-left font-medium">Nome</th>
                <th className="px-3 py-3 text-left font-medium">Origem</th>
                <th className="px-3 py-3 text-left font-medium">Etapa</th>
                <th className="px-3 py-3 text-left font-medium">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentLeads.map((lead) => {
                const badge = SOURCE_BADGE[lead.source] || SOURCE_BADGE.organico;
                return (
                  <tr key={lead.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{lead.name}</p>
                      <p className="text-xs text-slate-500">{lead.phone}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{lead.stageName || '-'}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDate(lead.createdAt)}</td>
                  </tr>
                );
              })}
              {recentLeads.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                    Nenhum lead encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Surface>
      </section>
    </div>
  );
}
