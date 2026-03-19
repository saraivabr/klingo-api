import React from 'react';
import { LucideIcon } from 'lucide-react';
import ConversationCard from './ConversationCard';
import type { Conversation } from '../../types/conversation';

type ColumnType = 'ai' | 'waiting' | 'human' | 'closed';

const COLUMN_BG: Record<ColumnType, string> = {
  ai: 'bg-emerald-50/40',
  waiting: 'bg-amber-50/40',
  human: 'bg-blue-50/40',
  closed: 'bg-slate-50/40',
};

const HEADER_BG: Record<ColumnType, string> = {
  ai: 'bg-emerald-50 border-emerald-200',
  waiting: 'bg-amber-50 border-amber-200',
  human: 'bg-blue-50 border-blue-200',
  closed: 'bg-slate-100 border-slate-200',
};

interface KanbanColumnProps {
  title: string;
  icon: LucideIcon;
  color: string;
  dotColor: string;
  conversations: Conversation[];
  column: ColumnType;
  onCardClick: (conversation: Conversation) => void;
  onAssign?: (id: string) => void;
  onRelease?: (id: string) => void;
  onClose?: (id: string) => void;
}

export default function KanbanColumn({
  title, icon: Icon, color, dotColor, conversations, column,
  onCardClick, onAssign, onRelease, onClose,
}: KanbanColumnProps) {
  return (
    <div className={`flex flex-col min-w-[280px] max-w-[340px] flex-1 rounded-xl ${COLUMN_BG[column]} border border-slate-100`}>
      <div className={`flex items-center gap-2 px-3 py-2.5 mb-1 rounded-t-xl border-b ${HEADER_BG[column]}`}>
        <div className={`w-2.5 h-2.5 rounded-full ${dotColor} ring-2 ring-white shadow-sm`} />
        <Icon size={15} className={color} />
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
          conversations.length > 0
            ? `${dotColor} text-white shadow-sm`
            : 'bg-slate-100 text-slate-400'
        }`}>
          {conversations.length}
        </span>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-2 py-2 pb-4 kanban-scroll">
        {conversations.length === 0 ? (
          <div className="text-center py-8 text-sm text-slate-300">Nenhuma conversa</div>
        ) : (
          conversations.map(c => (
            <ConversationCard
              key={c._id}
              conversation={c}
              column={column}
              onClick={() => onCardClick(c)}
              onAssign={onAssign ? () => onAssign(c._id) : undefined}
              onRelease={onRelease ? () => onRelease(c._id) : undefined}
              onClose={onClose ? () => onClose(c._id) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}
