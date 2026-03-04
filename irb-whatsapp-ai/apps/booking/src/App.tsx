import { useState, useEffect } from 'react';
import SlotPicker from './SlotPicker';
import PatientForm from './PatientForm';
import Confirmation from './Confirmation';
import Expired from './Expired';
import Loading from './Loading';

interface BookingData {
  specialty: string;
  patientName: string | null;
  patientPhone: string | null;
  expiresAt: string;
  doctors: { id: string; name: string; crm: string }[];
  service: { id: string; name: string; priceCents: number | null; durationMinutes: number | null } | null;
  slots: { date: string; time: string; dateTime: string }[];
}

type Step = 'loading' | 'slots' | 'form' | 'confirming' | 'done' | 'expired' | 'error';

const API_BASE = import.meta.env.VITE_API_BASE || '';

function getTokenFromUrl(): string | null {
  const path = window.location.pathname;
  const match = path.match(/\/agendar\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export default function App() {
  const [step, setStep] = useState<Step>('loading');
  const [data, setData] = useState<BookingData | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = getTokenFromUrl();

  useEffect(() => {
    if (!token) {
      setStep('error');
      setError('Link inválido');
      return;
    }

    fetch(`${API_BASE}/api/booking/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (body.status === 'booked' || body.status === 'expired' || res.status === 410) {
            setStep('expired');
            setError(body.error || 'Link expirado');
            return;
          }
          throw new Error(body.error || 'Erro ao carregar');
        }
        const json = await res.json();
        setData(json);
        setStep('slots');
        if (json.doctors.length === 1) {
          setSelectedDoctor(json.doctors[0].id);
        }
      })
      .catch((err) => {
        setStep('error');
        setError(err.message);
      });
  }, [token]);

  const handleSlotSelect = (dateTime: string) => {
    setSelectedSlot(dateTime);
    setStep('form');
  };

  const handleConfirm = async (patientName: string, cpf: string, birthDate: string, email?: string) => {
    if (!token || !selectedSlot) return;

    setStep('confirming');
    try {
      const res = await fetch(`${API_BASE}/api/booking/${token}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName,
          cpf,
          birthDate,
          email: email || undefined,
          doctorId: selectedDoctor || undefined,
          slotDateTime: selectedSlot,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Erro ao confirmar');
      }

      setStep('done');
    } catch (err: any) {
      setError(err.message);
      setStep('form');
    }
  };

  const handleBack = () => {
    setStep('slots');
    setSelectedSlot(null);
    setError(null);
  };

  if (step === 'loading' || step === 'confirming') {
    return <Loading text={step === 'confirming' ? 'Confirmando agendamento...' : 'Carregando horários...'} />;
  }

  if (step === 'expired') {
    return <Expired message={error} />;
  }

  if (step === 'error') {
    return <Expired message={error || 'Ocorreu um erro'} />;
  }

  if (step === 'done') {
    const slot = data?.slots.find(s => s.dateTime === selectedSlot);
    const doctor = data?.doctors.find(d => d.id === selectedDoctor);
    return (
      <Confirmation
        specialty={data?.specialty || ''}
        doctorName={doctor?.name}
        date={slot?.date || ''}
        time={slot?.time || ''}
        patientPhone={data?.patientPhone}
      />
    );
  }

  if (step === 'form' && data) {
    return (
      <PatientForm
        defaultName={data.patientName || ''}
        phone={data.patientPhone || ''}
        specialty={data.specialty}
        selectedTime={selectedSlot || ''}
        doctors={data.doctors}
        selectedDoctor={selectedDoctor}
        onSelectDoctor={setSelectedDoctor}
        onConfirm={handleConfirm}
        onBack={handleBack}
        error={error}
        service={data.service}
      />
    );
  }

  if (step === 'slots' && data) {
    return (
      <SlotPicker
        specialty={data.specialty}
        slots={data.slots}
        service={data.service}
        onSelect={handleSlotSelect}
      />
    );
  }

  return null;
}
