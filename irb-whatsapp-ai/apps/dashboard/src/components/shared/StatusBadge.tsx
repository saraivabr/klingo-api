import React from 'react';

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  ai: { label: 'IA', classes: 'bg-emerald-100 text-emerald-700' },
  waiting: { label: 'Aguardando', classes: 'bg-amber-100 text-amber-700' },
  human: { label: 'Atendimento', classes: 'bg-blue-100 text-blue-700' },
  closed: { label: 'Fechada', classes: 'bg-slate-100 text-slate-500' },
};

interface StatusBadgeProps {
  status: 'ai' | 'waiting' | 'human' | 'closed';
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.closed;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${config.classes}`}>
      {config.label}
    </span>
  );
}
