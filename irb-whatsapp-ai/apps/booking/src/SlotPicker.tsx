interface Slot {
  date: string;
  time: string;
  dateTime: string;
}

interface Props {
  specialty: string;
  slots: Slot[];
  service: { name: string; priceCents: number | null; durationMinutes: number | null } | null;
  onSelect: (dateTime: string) => void;
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
      <div className="bg-irb-primary text-white px-5 py-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <p className="text-xs uppercase tracking-wider opacity-80">IRB Prime Care</p>
          <h1 className="text-xl font-bold mt-1">{specialty}</h1>
          {service && (
            <p className="text-sm mt-1 opacity-90">
              {service.priceCents ? `R$ ${(service.priceCents / 100).toFixed(2)}` : ''}
              {service.durationMinutes ? ` · ${service.durationMinutes} min` : ''}
            </p>
          )}
          <p className="text-sm mt-2 opacity-80">Escolha o melhor horário para você</p>
        </div>
      </div>

      {/* Slots */}
      <div className="max-w-lg mx-auto px-5 py-6 space-y-6">
        {dates.length === 0 && (
          <p className="text-center text-gray-500 py-8">Nenhum horário disponível no momento</p>
        )}

        {dates.map((date) => (
          <div key={date}>
            <h2 className="text-sm font-semibold text-gray-700 mb-3 capitalize">{formatDate(date)}</h2>
            <div className="grid grid-cols-3 gap-2">
              {grouped[date].map((slot) => (
                <button
                  key={slot.dateTime}
                  onClick={() => onSelect(slot.dateTime)}
                  className="py-3 px-2 rounded-xl border-2 border-irb-light bg-white text-irb-dark font-medium text-sm hover:bg-irb-primary hover:text-white hover:border-irb-primary active:scale-95 transition-all"
                >
                  {slot.time}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
