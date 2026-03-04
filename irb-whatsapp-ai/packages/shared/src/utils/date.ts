const BRT_OFFSET = -3;

export function nowBRT(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + BRT_OFFSET * 3600000);
}

export function isBusinessHours(date?: Date): boolean {
  const d = date ?? nowBRT();
  const day = d.getDay();
  const hour = d.getHours();
  if (day === 0) return false; // domingo
  if (day === 6) return hour >= 8 && hour < 12; // sábado 8-12
  return hour >= 7 && hour < 19; // seg-sex 7-19
}

export function formatDateBR(date: Date): string {
  return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function formatTimeBR(date: Date): string {
  return date.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  });
}
