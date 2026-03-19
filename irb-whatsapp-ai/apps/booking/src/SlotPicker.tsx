interface Slot {
  date: string;
  time: string;
  dateTime: string;
  source?: 'klingo' | 'fallback';
  klingoSlotId?: string | number;
}

interface Props {
  specialty: string;
  slots: Slot[];
  service: { name: string; priceCents: number | null; durationMinutes: number | null } | null;
  onSelect: (slot: Slot) => void;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
  return `${weekday}, ${day}/${String(month).padStart(2, '0')}`;
}

function groupByDate(slots: Slot[]): Record<string, Slot[]> {
  const groups: Record<string, Slot[]> = {};
  for (const slot of slots) {
    if (!groups[slot.date]) groups[slot.date] = [];
    groups[slot.date].push(slot);
  }
  return groups;
}

export default function SlotPicker({ specialty, slots, service, onSelect }: Props) {
  const grouped = groupByDate(slots);
  const dates = Object.keys(grouped).sort();

  return (
    <div className="min-h-screen bg-irb-bg">
      {/* Header */}
      <div className="bg-gradient-to-br from-irb-primary to-irb-dark text-white px-5 py-8 rounded-b-3xl shadow-lg">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <img src="/agendar/logo-irb.svg" alt="IRB Prime Care" className="h-12 w-12" />
            <div>
              <p className="text-sm font-bold tracking-wide">IRB <span className="text-irb-gold-light">Prime Care</span></p>
              <p className="text-[10px] tracking-widest text-white/60 uppercase">excellence in health</p>
            </div>
          </div>
          <h1 className="text-2xl font-bold">{specialty}</h1>
          {service && (
            <p className="text-sm mt-1 text-white/70">
              {service.priceCents ? `R$ ${(service.priceCents / 100).toFixed(2)}` : ''}
              {service.durationMinutes ? ` · ${service.durationMinutes} min` : ''}
            </p>
          )}
          <p className="text-sm mt-3 text-irb-gold-light">Escolha o melhor horario para voce</p>
        </div>
      </div>

      {/* Slots */}
      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">
        {dates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Nenhum horario disponivel no momento</p>
            <p className="text-sm text-gray-400 mt-2">Entre em contato pelo WhatsApp para mais opcoes</p>
          </div>
        )}

        {dates.map((date) => (
          <div key={date}>
            <h2 className="text-sm font-semibold text-irb-primary mb-3 capitalize">{formatDate(date)}</h2>
            <div className="grid grid-cols-3 gap-2">
              {grouped[date].map((slot) => (
                <button
                  key={slot.dateTime}
                  onClick={() => onSelect(slot)}
                  className="py-3 px-2 rounded-xl border-2 border-gray-200 bg-white text-irb-primary font-semibold text-sm hover:bg-irb-primary hover:text-white hover:border-irb-primary active:scale-95 transition-all shadow-sm"
                >
                  {slot.time}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="max-w-lg mx-auto px-5 pb-8">
        <p className="text-center text-xs text-gray-400">excellence in health</p>
      </div>
    </div>
  );
}
