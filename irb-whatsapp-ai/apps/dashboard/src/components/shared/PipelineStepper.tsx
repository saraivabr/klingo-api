import React from 'react';

const PIPELINE_STEPS = [
  { key: 'greeting', label: 'Olá', states: ['greeting'] },
  { key: 'understanding', label: 'Entendendo', states: ['exploring', 'service_inquiry', 'price_discussion'] },
  { key: 'scheduling', label: 'Agendando', states: ['scheduling', 'collecting_info'] },
  { key: 'confirming', label: 'Confirmando', states: ['confirmation'] },
  { key: 'done', label: 'Concluído', states: ['post_booking', 'follow_up'] },
];

function getStepIndex(state: string): number {
  const idx = PIPELINE_STEPS.findIndex(step => step.states.includes(state));
  return idx === -1 ? 0 : idx;
}

interface PipelineStepperProps {
  state: string;
}

export default function PipelineStepper({ state }: PipelineStepperProps) {
  const currentIndex = getStepIndex(state);
  const progress = ((currentIndex + 1) / PIPELINE_STEPS.length) * 100;
  const currentLabel = PIPELINE_STEPS[currentIndex]?.label;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-[10px] font-medium text-emerald-600 whitespace-nowrap">
        {currentLabel}
      </span>
    </div>
  );
}
