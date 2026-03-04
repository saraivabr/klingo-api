import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Phone, Calendar, MessageSquare, Clock, AlertTriangle, User, Stethoscope, Link2 } from 'lucide-react';
import Avatar from '../shared/Avatar';
import type { PatientContext, ConversationSummary } from '../../types/patient-context';

interface PatientSidebarProps {
  context: PatientContext | null;
  loading: boolean;
  currentConversationId: string;
  onViewConversation: (id: string) => void;
}

function Section({ title, icon: Icon, defaultOpen = true, children }: { title: string; icon: React.ElementType; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 text-left">
        {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        <Icon size={14} className="text-slate-500" />
        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{title}</span>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-200 rounded animate-pulse ${className}`} />;
}

function Badge({ children, color = 'slate' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    rose: 'bg-rose-100 text-rose-700',
    violet: 'bg-violet-100 text-violet-700',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${colors[color] || colors.slate}`}>
      {children}
    </span>
  );
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatDateTime(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatMs(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'active': return 'emerald';
    case 'escalated': return 'amber';
    case 'closed': return 'slate';
    case 'scheduled': return 'blue';
    case 'completed': return 'emerald';
    case 'cancelled': return 'rose';
    case 'pending': return 'amber';
    case 'booked': return 'emerald';
    case 'expired': return 'rose';
    default: return 'slate';
  }
}

export default function PatientSidebar({ context, loading, currentConversationId, onViewConversation }: PatientSidebarProps) {
  const [historyTab, setHistoryTab] = useState<'conversations' | 'appointments'>('conversations');

  if (loading) {
    return (
      <div className="w-[380px] border-l border-slate-200 bg-white overflow-y-auto shrink-0">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!context) return null;

  const currentConv = context.conversations.find(c => c.isCurrent);
  const otherConvs = context.conversations.filter(c => !c.isCurrent);
  const totalConversations = context.conversations.length;
  const totalAppointments = context.appointments.length;

  return (
    <div className="w-[380px] border-l border-slate-200 bg-white overflow-y-auto shrink-0">
      {/* Perfil */}
      <Section title="Perfil" icon={User} defaultOpen={true}>
        <div className="flex items-center gap-3 mb-3">
          <Avatar name={context.patient?.name || context.conversations[0]?._id || '?'} size="lg" />
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">
              {context.patient?.name || 'Paciente não cadastrado'}
            </p>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Phone size={10} /> {context.patient?.phone || '—'}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-50 rounded-lg py-2 px-1">
            <p className="text-lg font-bold text-slate-900">{totalConversations}</p>
            <p className="text-[10px] text-slate-500">Conversas</p>
          </div>
          <div className="bg-slate-50 rounded-lg py-2 px-1">
            <p className="text-lg font-bold text-slate-900">{totalAppointments}</p>
            <p className="text-[10px] text-slate-500">Consultas</p>
          </div>
          <div className="bg-slate-50 rounded-lg py-2 px-1">
            <p className="text-lg font-bold text-slate-900">{context.patient ? formatDate(context.patient.createdAt) : '—'}</p>
            <p className="text-[10px] text-slate-500">Desde</p>
          </div>
        </div>
      </Section>

      {/* Resumo da Conversa Atual */}
      <Section title="Resumo" icon={MessageSquare} defaultOpen={true}>
        {currentConv ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-700 leading-relaxed">
              {currentConv.summary || <span className="text-slate-400 italic">Sem resumo disponível</span>}
            </p>

            {currentConv.detectedIntents.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase mb-1">Intenções</p>
                <div className="flex flex-wrap gap-1">
                  {currentConv.detectedIntents.map(i => <Badge key={i} color="blue">{i}</Badge>)}
                </div>
              </div>
            )}

            {currentConv.detectedAnxieties.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase mb-1">Ansiedades</p>
                <div className="flex flex-wrap gap-1">
                  {currentConv.detectedAnxieties.map(a => <Badge key={a} color="rose">{a}</Badge>)}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 rounded px-2 py-1.5">
                <p className="text-[10px] text-slate-400">Mensagens</p>
                <p className="text-sm font-semibold text-slate-700">{currentConv.metrics.totalMessages}</p>
              </div>
              <div className="bg-slate-50 rounded px-2 py-1.5">
                <p className="text-[10px] text-slate-400">Tempo médio resp.</p>
                <p className="text-sm font-semibold text-slate-700">{formatMs(currentConv.metrics.avgResponseTimeMs)}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">Sem dados</p>
        )}
      </Section>

      {/* Agendamento */}
      <Section title="Agendamento" icon={Calendar} defaultOpen={true}>
        {context.appointments.length > 0 ? (
          <div className="space-y-2">
            {context.appointments.slice(0, 3).map(appt => (
              <div key={appt.id} className="bg-slate-50 rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700">{appt.doctorName || 'Médico'}</span>
                  <Badge color={statusColor(appt.status)}>{appt.status}</Badge>
                </div>
                <p className="text-[11px] text-slate-500">
                  <Calendar size={10} className="inline mr-1" />
                  {formatDateTime(appt.scheduledAt)}
                </p>
                {appt.serviceName && <p className="text-[11px] text-slate-400 mt-0.5">{appt.serviceName}</p>}
              </div>
            ))}
          </div>
        ) : context.bookingLinks.length > 0 ? (
          <div className="space-y-2">
            {context.bookingLinks.slice(0, 3).map(link => (
              <div key={link.id} className="bg-slate-50 rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-700 flex items-center gap-1">
                    <Link2 size={10} /> {link.specialty}
                  </span>
                  <Badge color={statusColor(link.status)}>{link.status}</Badge>
                </div>
                <p className="text-[11px] text-slate-500">Expira: {formatDateTime(link.expiresAt)}</p>
                {link.bookedAt && <p className="text-[11px] text-emerald-600">Agendado: {formatDateTime(link.bookedAt)}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">Sem agendamento</p>
        )}
      </Section>

      {/* Histórico */}
      <Section title="Histórico" icon={Clock} defaultOpen={false}>
        <div className="flex gap-1 mb-3">
          <button
            onClick={() => setHistoryTab('conversations')}
            className={`flex-1 px-2 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              historyTab === 'conversations' ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            Conversas ({totalConversations})
          </button>
          <button
            onClick={() => setHistoryTab('appointments')}
            className={`flex-1 px-2 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              historyTab === 'appointments' ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            Consultas ({totalAppointments})
          </button>
        </div>

        {historyTab === 'conversations' ? (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {context.conversations.map(conv => (
              <button
                key={conv._id}
                onClick={() => !conv.isCurrent && onViewConversation(conv._id)}
                className={`w-full text-left rounded-lg p-2.5 transition-colors ${
                  conv.isCurrent
                    ? 'bg-primary-50 border border-primary-200'
                    : 'bg-slate-50 hover:bg-slate-100 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] text-slate-500">{formatDateTime(conv.startedAt)}</span>
                  <Badge color={statusColor(conv.status)}>{conv.isCurrent ? 'atual' : conv.status}</Badge>
                </div>
                <p className="text-xs text-slate-700 line-clamp-2">
                  {conv.summary || 'Sem resumo'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{conv.metrics.totalMessages} msgs</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {context.appointments.length > 0 ? context.appointments.map(appt => (
              <div key={appt.id} className="bg-slate-50 rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] text-slate-500">{formatDateTime(appt.scheduledAt)}</span>
                  <Badge color={statusColor(appt.status)}>{appt.status}</Badge>
                </div>
                <p className="text-xs font-medium text-slate-700">{appt.doctorName || 'Médico'}</p>
                {appt.serviceName && <p className="text-[10px] text-slate-400">{appt.serviceName}</p>}
              </div>
            )) : (
              <p className="text-xs text-slate-400 italic text-center py-2">Nenhuma consulta registrada</p>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}
