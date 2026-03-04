import React from 'react';
import { MessageCircle, Search, Calendar, CheckCircle, Check, AlertTriangle, Archive, ChevronRight } from 'lucide-react';
import KanbanColumn from './KanbanColumn';
import type { Conversation, PipelineColumns, PipelineStage } from '../../types/conversation';

const PIPELINE_STAGES: { key: PipelineStage; label: string; icon: typeof MessageCircle; color: string; dot: string }[] = [
  { key: 'greeting', label: 'Olá', icon: MessageCircle, color: 'text-slate-500', dot: 'bg-slate-400' },
  { key: 'understanding', label: 'Entendendo', icon: Search, color: 'text-blue-600', dot: 'bg-blue-500' },
  { key: 'scheduling', label: 'Agendando', icon: Calendar, color: 'text-violet-600', dot: 'bg-violet-500' },
  { key: 'confirming', label: 'Confirmando', icon: CheckCircle, color: 'text-amber-600', dot: 'bg-amber-500' },
  { key: 'done', label: 'Concluído', icon: Check, color: 'text-emerald-600', dot: 'bg-emerald-500' },
];

const EXTRA_STAGES: { key: PipelineStage; label: string; icon: typeof AlertTriangle; color: string; dot: string }[] = [
  { key: 'escalated', label: 'Escaladas', icon: AlertTriangle, color: 'text-red-500', dot: 'bg-red-400' },
  { key: 'closed', label: 'Fechadas', icon: Archive, color: 'text-slate-400', dot: 'bg-slate-300' },
];

interface KanbanBoardProps {
  pipeline: PipelineColumns;
  onCardClick: (conversation: Conversation) => void;
  onAssign: (id: string) => void;
  onRelease: (id: string) => void;
  onClose: (id: string) => void;
}

export default function KanbanBoard({ pipeline, onCardClick, onAssign, onRelease, onClose }: KanbanBoardProps) {
  // Total de conversas ativas no pipeline
  const totalActive = PIPELINE_STAGES.reduce((sum, s) => sum + pipeline[s.key].length, 0);

  return (
    <div className="flex flex-col h-full px-6 pb-2">
      {/* Pipeline progress header */}
      <div className="flex items-center gap-0 mb-4 px-2">
        {PIPELINE_STAGES.map((stage, i) => {
          const count = pipeline[stage.key].length;
          const Icon = stage.icon;
          return (
            <React.Fragment key={stage.key}>
              {i > 0 && <ChevronRight size={14} className="text-slate-200 mx-1 shrink-0" />}
              <div className="flex items-center gap-1.5">
                <Icon size={13} className={count > 0 ? stage.color : 'text-slate-300'} />
                <span className={`text-xs font-medium ${count > 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                  {stage.label}
                </span>
                {count > 0 && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${stage.dot} text-white`}>
                    {count}
                  </span>
                )}
              </div>
            </React.Fragment>
          );
        })}
        <div className="ml-auto text-xs text-slate-400">
          {totalActive} ativa{totalActive !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Columns */}
      <div className="flex gap-3 h-full overflow-x-auto">
        {PIPELINE_STAGES.map((stage) => {
          const conversations = pipeline[stage.key];
          if (conversations.length === 0) return null;
          return (
            <KanbanColumn
              key={stage.key}
              title={stage.label}
              icon={stage.icon}
              color={stage.color}
              dotColor={stage.dot}
              conversations={conversations}
              column="ai"
              onCardClick={onCardClick}
              onAssign={onAssign}
              onClose={onClose}
            />
          );
        })}

        {/* Separator if there are extra columns */}
        {(pipeline.escalated.length > 0 || pipeline.closed.length > 0) &&
          PIPELINE_STAGES.some(s => pipeline[s.key].length > 0) && (
          <div className="w-px bg-slate-200 shrink-0 my-4" />
        )}

        {EXTRA_STAGES.map((stage) => {
          const conversations = pipeline[stage.key];
          if (conversations.length === 0) return null;
          return (
            <KanbanColumn
              key={stage.key}
              title={stage.label}
              icon={stage.icon}
              color={stage.color}
              dotColor={stage.dot}
              conversations={conversations}
              column={stage.key === 'escalated' ? 'waiting' : 'closed'}
              onCardClick={onCardClick}
              onAssign={stage.key === 'escalated' ? onAssign : undefined}
              onRelease={stage.key === 'escalated' ? onRelease : undefined}
              onClose={stage.key === 'escalated' ? onClose : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
