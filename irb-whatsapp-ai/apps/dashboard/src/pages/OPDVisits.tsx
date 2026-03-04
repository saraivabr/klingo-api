import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Search, Clock, CheckCircle, AlertCircle, Loader2, ChevronRight, Pill, Heart, FileText,
} from 'lucide-react';
import { api } from '../services/api';
import OPDVisitDetailModal from '../components/opd/OPDVisitDetailModal';
import NewOPDVisitForm from '../components/opd/NewOPDVisitForm';

/* ── types ─────────────────────────────────────── */

interface OPDVisit {
  id: string;
  patientId: string;
  patientName: string | null;
  patientPhone: string;
  doctorId: string;
  doctorName: string | null;
  doctorSpecialty: string | null;
  visitDate: string;
  caseId: string | null;
  symptoms: string | null;
  status: 'waiting' | 'in-progress' | 'completed';
  createdAt: string;
}

/* ── helpers ───────────────────────────────────── */

const STATUS_CONFIG: Record<string, { label: string; bg: string; dot: string; icon: React.ReactNode }> = {
  waiting: {
    label: 'Aguardando',
    bg: 'bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
    icon: <Clock size={16} />,
  },
  'in-progress': {
    label: 'Em Atendimento',
    bg: 'bg-blue-50 text-blue-700',
    dot: 'bg-blue-500',
    icon: <AlertCircle size={16} />,
  },
  completed: {
    label: 'Concluído',
    bg: 'bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
    icon: <CheckCircle size={16} />,
  },
};

function fmtDateTime(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('pt-BR');
}

/* ── component ─────────────────────────────────── */

export default function OPDVisits() {
  const [visits, setVisits] = useState<OPDVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showNewVisit, setShowNewVisit] = useState(false);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);

  const loadVisits = useCallback(() => {
    setLoading(true);
    api.getOPDVisits({ status: filter !== 'all' ? filter : undefined, search })
      .then(data => setVisits(data.visits || []))
      .catch(err => {
        console.error('Failed to load OPD visits:', err);
        setVisits([]);
      })
      .finally(() => setLoading(false));
  }, [filter, search]);

  useEffect(() => { loadVisits(); }, [loadVisits]);

  const filters = [
    { key: 'all', label: 'Todas', count: visits.length },
    { key: 'waiting', label: 'Aguardando', dot: 'bg-amber-500' },
    { key: 'in-progress', label: 'Em Atendimento', dot: 'bg-blue-500' },
    { key: 'completed', label: 'Concluídas', dot: 'bg-emerald-500' },
  ];

  // Quick stats
  const waitingCount = visits.filter(v => v.status === 'waiting').length;
  const inProgressCount = visits.filter(v => v.status === 'in-progress').length;
  const completedCount = visits.filter(v => v.status === 'completed').length;

  return (
    <div className="px-8 py-7 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Consultas OPD</h2>
          <p className="text-slate-500 text-sm mt-0.5">Registros de visitas e atendimentos ambulatoriais</p>
        </div>
        <button
          onClick={() => setShowNewVisit(true)}
          className="group flex items-center gap-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white pl-4 pr-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-blue-200/50 hover:shadow-blue-300/60 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
            <Plus size={14} strokeWidth={3} />
          </div>
          Nova Consulta
        </button>
      </div>

      {/* Quick Stats */}
      {!loading && visits.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-7 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Clock size={18} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-600">Aguardando</p>
              <p className="text-lg font-bold text-slate-900">{waitingCount}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <AlertCircle size={18} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-600">Em Atendimento</p>
              <p className="text-lg font-bold text-slate-900">{inProgressCount}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle size={18} className="text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-600">Concluídas</p>
              <p className="text-lg font-bold text-slate-900">{completedCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                filter === f.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {f.key !== 'all' && f.dot && <span className={`inline-block w-2 h-2 rounded-full ${f.dot} mr-2`} />}
              {f.label} {f.count !== undefined && f.count > 0 && <span className="ml-1 text-xs opacity-70">({f.count})</span>}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Paciente, doutor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Visits List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-slate-400" size={32} />
        </div>
      ) : visits.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <FileText size={24} className="text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Nenhuma consulta</h3>
          <p className="text-slate-500 mb-6">Crie uma nova consulta para começar</p>
          <button
            onClick={() => setShowNewVisit(true)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Nova Consulta
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {visits.map(visit => {
            const config = STATUS_CONFIG[visit.status] || STATUS_CONFIG.waiting;
            return (
              <button
                key={visit.id}
                onClick={() => setSelectedVisitId(visit.id)}
                className="w-full bg-white rounded-2xl border border-slate-100 p-4 hover:border-slate-200 hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                        {config.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900">{visit.patientName || 'Paciente'}</h3>
                        <p className="text-xs text-slate-500">{visit.patientPhone}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 mt-3">
                      <div className="flex items-center gap-1.5">
                        <Heart size={14} />
                        <span>{visit.doctorName || 'Sem doutor'}</span>
                        {visit.doctorSpecialty && <span className="text-xs opacity-60">({visit.doctorSpecialty})</span>}
                      </div>
                      <span>•</span>
                      <span>{fmtDate(visit.visitDate)}</span>
                      {visit.symptoms && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1"><Pill size={13} /> {visit.symptoms.substring(0, 30)}{visit.symptoms.length > 30 ? '...' : ''}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                    <div className={`px-3 py-1.5 rounded-lg ${config.bg} text-xs font-semibold`}>
                      {config.label}
                    </div>
                    <ChevronRight size={20} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showNewVisit && <NewOPDVisitForm onClose={() => setShowNewVisit(false)} onSuccess={() => { setShowNewVisit(false); loadVisits(); }} />}
      {selectedVisitId && <OPDVisitDetailModal visitId={selectedVisitId} onClose={() => setSelectedVisitId(null)} onUpdate={() => loadVisits()} />}
    </div>
  );
}
