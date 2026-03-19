import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, UserPlus, Bot, XCircle, CheckCircle2, Clock, Link2, AlertTriangle, MessageSquare, Zap, Hourglass, ArrowRight } from 'lucide-react';
import Avatar from '../shared/Avatar';
import TimeAgo from '../shared/TimeAgo';
import type { Conversation } from '../../types/conversation';

type ColumnType = 'ai' | 'waiting' | 'human' | 'closed';

const BORDER_COLORS: Record<ColumnType, string> = {
  ai: 'border-l-emerald-500',
  waiting: 'border-l-amber-500',
  human: 'border-l-blue-500',
  closed: 'border-l-slate-400',
};

const STATE_LABELS: Record<string, { label: string; color: string; icon?: string }> = {
  greeting: { label: 'Primeiro contato', color: 'bg-slate-100 text-slate-600' },
  exploring: { label: 'Explorando', color: 'bg-blue-50 text-blue-600' },
  service_inquiry: { label: 'Consulta', color: 'bg-blue-50 text-blue-600' },
  price_discussion: { label: 'Preço', color: 'bg-violet-50 text-violet-600' },
  scheduling: { label: 'Agendando', color: 'bg-violet-50 text-violet-600' },
  collecting_info: { label: 'Coletando dados', color: 'bg-violet-50 text-violet-600' },
  confirmation: { label: 'Confirmando', color: 'bg-amber-50 text-amber-600' },
  post_booking: { label: 'Agendado', color: 'bg-emerald-50 text-emerald-600' },
  follow_up: { label: 'Follow-up', color: 'bg-emerald-50 text-emerald-600' },
  escalated: { label: 'Escalada', color: 'bg-red-50 text-red-600' },
  active: { label: 'Ativa', color: 'bg-blue-50 text-blue-600' },
};

interface ConversationCardProps {
  conversation: Conversation;
  column: ColumnType;
  onClick: () => void;
  onAssign?: () => void;
  onRelease?: () => void;
  onClose?: () => void;
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatDuration(startedAt?: string) {
  if (!startedAt) return null;
  const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h${mins % 60 > 0 ? `${mins % 60}m` : ''}`;
  return `${Math.floor(hrs / 24)}d`;
}

function getWaitTime(lastMessageAt?: string): { text: string; level: 'ok' | 'warn' | 'danger' } | null {
  if (!lastMessageAt) return null;
  const mins = Math.floor((Date.now() - new Date(lastMessageAt).getTime()) / 60000);
  if (mins < 5) return { text: 'Agora', level: 'ok' };
  if (mins < 30) return { text: `${mins}min sem resposta`, level: 'ok' };
  if (mins < 60) return { text: `${mins}min sem resposta`, level: 'warn' };
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return { text: `${hrs}h sem resposta`, level: 'danger' };
  return { text: `${Math.floor(hrs / 24)}d sem resposta`, level: 'danger' };
}

function formatResponseTime(ms?: number): string | null {
  if (!ms || ms === 0) return null;
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.round(secs / 60)}min`;
}

interface MenuAction {
  label: string;
  icon: typeof UserPlus;
  color: string;
  onClick: () => void;
}

export default function ConversationCard({ conversation: c, column, onClick, onAssign, onRelease, onClose }: ConversationCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const actions: MenuAction[] = [];
  if (column === 'ai' || column === 'waiting') {
    if (onAssign) actions.push({ label: 'Assumir conversa', icon: UserPlus, color: 'text-amber-600 hover:bg-amber-50', onClick: onAssign });
  }
  if (column === 'waiting' || column === 'human') {
    if (onRelease) actions.push({ label: 'Devolver para IA', icon: Bot, color: 'text-emerald-600 hover:bg-emerald-50', onClick: onRelease });
  }
  if (column === 'ai' || column === 'human' || column === 'waiting') {
    if (onClose) actions.push({ label: 'Fechar conversa', icon: XCircle, color: 'text-red-500 hover:bg-red-50', onClick: onClose });
  }

  const isBooked = c.appointment?.status === 'scheduled';
  const bookingPending = c.bookingLink?.status === 'pending' && !isBooked;
  const bookingExpired = c.bookingLink?.status === 'expired' && !isBooked;
  const duration = formatDuration(c.startedAt);
  const stateInfo = STATE_LABELS[c.state] || STATE_LABELS['active'];
  const waitTime = column !== 'closed' ? getWaitTime(c.lastMessageAt) : null;
  const avgResponse = formatResponseTime(c.metrics?.avgResponseTimeMs);

  // Detect intents for display
  const intents = c.detectedIntents?.slice(0, 2) || [];

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg shadow-sm hover:shadow-md border-l-[3px] ${BORDER_COLORS[column]} p-2.5 cursor-pointer transition-all duration-200 animate-slide-up space-y-1.5 relative group`}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Avatar name={c.patientName || c.patientPhone} size="sm" />
        <div className="flex-1 min-w-0">
          <span className="font-medium text-[13px] text-slate-900 truncate block">
            {c.patientName || c.patientPhone}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-slate-400">{c.patientPhone}</span>
            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${stateInfo.color}`}>
              {stateInfo.label}
            </span>
          </div>
        </div>

        {/* Menu trigger */}
        {actions.length > 0 && (
          <div ref={menuRef} className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal size={14} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 min-w-[180px] animate-fade-in">
                {actions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(false);
                        action.onClick();
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm ${action.color} transition-colors`}
                    >
                      <Icon size={14} />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {actions.length === 0 && (
          <TimeAgo date={c.lastMessageAt} className="text-[10px] text-slate-300 shrink-0" />
        )}
      </div>

      {/* Wait time indicator */}
      {waitTime && waitTime.level !== 'ok' && (
        <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${
          waitTime.level === 'warn' ? 'text-amber-600 bg-amber-50' : 'text-red-500 bg-red-50'
        }`}>
          <Hourglass size={10} className={waitTime.level === 'danger' ? 'animate-pulse' : ''} />
          <span className="text-[10px] font-medium">{waitTime.text}</span>
        </div>
      )}

      {/* Booking status */}
      {isBooked && (
        <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 rounded-md px-2 py-1">
          <CheckCircle2 size={11} />
          <span className="text-[10px] font-medium truncate">
            {c.appointment!.doctorName ? `${c.appointment!.doctorName} · ` : ''}{formatDateTime(c.appointment!.scheduledAt)}
          </span>
        </div>
      )}
      {bookingPending && (
        <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 rounded-md px-2 py-1">
          <Link2 size={11} />
          <span className="text-[10px] font-medium truncate">Link enviado · {c.bookingLink!.specialty}</span>
        </div>
      )}
      {bookingExpired && (
        <div className="flex items-center gap-1.5 text-red-500 bg-red-50 rounded-md px-2 py-1">
          <XCircle size={11} />
          <span className="text-[10px] font-medium">Link expirado</span>
        </div>
      )}

      {c.escapePhraseDetected && (
        <div className="flex items-center gap-1.5 text-red-500 bg-red-50 rounded-md px-2 py-1">
          <AlertTriangle size={11} />
          <span className="text-[10px] font-medium">Pediu atendente</span>
        </div>
      )}

      {/* Detected intents */}
      {intents.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {intents.map((intent, i) => (
            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-100">
              {intent.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      {/* Last message */}
      {c.lastPatientMessage && (
        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed pl-0.5">
          &ldquo;{c.lastPatientMessage}&rdquo;
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-0.5">
        <span className="flex items-center gap-0.5">
          <MessageSquare size={9} />
          {c.metrics?.totalMessages || 0}
        </span>
        {avgResponse && (
          <span className="flex items-center gap-0.5" title="Tempo médio de resposta">
            <Zap size={9} />
            {avgResponse}
          </span>
        )}
        {duration && (
          <span className="flex items-center gap-0.5">
            <Clock size={9} />{duration}
          </span>
        )}
        <TimeAgo date={c.lastMessageAt} className="text-[10px] text-slate-300 ml-auto shrink-0" />
      </div>
    </div>
  );
}
