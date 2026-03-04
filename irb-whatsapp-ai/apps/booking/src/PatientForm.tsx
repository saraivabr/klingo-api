import { useState } from 'react';

interface Props {
  defaultName: string;
  phone: string;
  specialty: string;
  selectedTime: string;
  doctors: { id: string; name: string; crm: string }[];
  selectedDoctor: string | null;
  onSelectDoctor: (id: string) => void;
  onConfirm: (name: string, cpf: string, birthDate: string, email?: string) => void;
  onBack: () => void;
  error: string | null;
  service: { name: string; priceCents: number | null } | null;
}

function formatSlotDisplay(iso: string): string {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${weekday}, ${date} às ${time}`;
}

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatBirthDate(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  return digits.length === 11;
}

function isValidBirthDate(date: string): boolean {
  const digits = date.replace(/\D/g, '');
  if (digits.length !== 8) return false;
  const day = parseInt(digits.slice(0, 2));
  const month = parseInt(digits.slice(2, 4));
  const year = parseInt(digits.slice(4, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (year < 1900 || year > new Date().getFullYear()) return false;
  return true;
}

export default function PatientForm({
  defaultName, phone, specialty, selectedTime,
  doctors, selectedDoctor, onSelectDoctor,
  onConfirm, onBack, error, service,
}: Props) {
  const [name, setName] = useState(defaultName);
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [commitment, setCommitment] = useState(false);

  const canSubmit = name.trim() &&
    isValidCpf(cpf) &&
    isValidBirthDate(birthDate) &&
    commitment &&
    (doctors.length <= 1 || !!selectedDoctor);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onConfirm(name.trim(), cpf.replace(/\D/g, ''), birthDate, email.trim() || undefined);
  };

  return (
    <div className="min-h-screen bg-irb-bg">
      {/* Header */}
      <div className="bg-irb-primary text-white px-5 py-5 rounded-b-3xl">
        <div className="max-w-lg mx-auto">
          <button onClick={onBack} className="text-white/80 text-sm mb-2 flex items-center gap-1">
            ← Voltar
          </button>
          <h1 className="text-lg font-bold">{specialty}</h1>
          <p className="text-sm mt-1 opacity-90 capitalize">{formatSlotDisplay(selectedTime)}</p>
          {service?.priceCents && (
            <p className="text-sm mt-1 opacity-80">R$ {(service.priceCents / 100).toFixed(2)}</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg mx-auto px-5 py-6 space-y-5">
        <p className="text-sm text-gray-600 bg-blue-50 px-4 py-3 rounded-xl">
          Preencha seus dados para agilizar seu atendimento na recepção
        </p>

        {/* Doctor selection */}
        {doctors.length > 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Médico(a)</label>
            <div className="space-y-2">
              {doctors.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => onSelectDoctor(doc.id)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                    selectedDoctor === doc.id
                      ? 'border-irb-primary bg-irb-bg'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <p className="font-medium text-sm">{doc.name}</p>
                  <p className="text-xs text-gray-500">CRM {doc.crm}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Seu nome completo
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-irb-primary focus:outline-none text-sm"
            placeholder="Digite seu nome"
          />
        </div>

        {/* CPF */}
        <div>
          <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-1">
            CPF
          </label>
          <input
            id="cpf"
            type="text"
            inputMode="numeric"
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
            required
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-irb-primary focus:outline-none text-sm"
            placeholder="000.000.000-00"
          />
        </div>

        {/* Birth date */}
        <div>
          <label htmlFor="birthDate" className="block text-sm font-medium text-gray-700 mb-1">
            Data de nascimento
          </label>
          <input
            id="birthDate"
            type="text"
            inputMode="numeric"
            value={birthDate}
            onChange={(e) => setBirthDate(formatBirthDate(e.target.value))}
            required
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-irb-primary focus:outline-none text-sm"
            placeholder="DD/MM/AAAA"
          />
        </div>

        {/* Phone (read-only) */}
        {phone && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <input
              type="text"
              value={phone}
              readOnly
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-gray-500 text-sm"
            />
          </div>
        )}

        {/* Email (optional) */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            E-mail <span className="text-gray-400">(opcional)</span>
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-irb-primary focus:outline-none text-sm"
            placeholder="seu@email.com"
          />
        </div>

        {/* Commitment checkbox */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={commitment}
            onChange={(e) => setCommitment(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-gray-300 text-irb-primary focus:ring-irb-primary"
          />
          <span className="text-sm text-gray-600 leading-snug">
            Me comprometo a comparecer na consulta agendada. Caso não consiga, entrarei em contato para remarcar ou cancelar.
          </span>
        </label>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-4 bg-irb-primary text-white font-semibold rounded-xl hover:bg-irb-dark active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          Confirmar agendamento
        </button>
      </form>
    </div>
  );
}
