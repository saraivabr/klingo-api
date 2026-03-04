import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color: string;
}

export default function MetricCard({ icon: Icon, label, value, color }: MetricCardProps) {
  return (
    <div className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
