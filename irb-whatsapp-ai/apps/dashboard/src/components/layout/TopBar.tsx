import React, { useEffect, useState } from 'react';
import { Users, CreditCard, AlertTriangle, DollarSign } from 'lucide-react';
import MetricCard from '../shared/MetricCard';
import { api } from '../../services/api';

export default function TopBar() {
  const [data, setData] = useState<{
    activeSubscriptions: number;
    overdueSubscriptions: number;
    monthRevenueCents: number;
    overdueTotalCents: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getFinanceSummary()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-4 px-6 py-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl px-4 py-3 shadow-sm h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  const fmt = (cents: number) => `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-6 py-4">
      <MetricCard icon={Users} label="Assinaturas Ativas" value={data?.activeSubscriptions ?? 0} color="bg-emerald-50 text-emerald-600" />
      <MetricCard icon={DollarSign} label="Receita Mensal" value={fmt(data?.monthRevenueCents ?? 0)} color="bg-blue-50 text-blue-600" />
      <MetricCard icon={AlertTriangle} label="Inadimplentes" value={data?.overdueSubscriptions ?? 0} color="bg-amber-50 text-amber-600" />
      <MetricCard icon={CreditCard} label="Valor Inadimplente" value={fmt(data?.overdueTotalCents ?? 0)} color="bg-rose-50 text-rose-600" />
    </div>
  );
}
