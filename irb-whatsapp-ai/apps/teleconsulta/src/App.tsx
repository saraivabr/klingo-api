import { useState, useEffect } from 'react';
import Loading from './components/Loading';
import WaitingRoom from './components/WaitingRoom';
import InCall from './components/InCall';
import PostCall from './components/PostCall';
import ErrorScreen from './components/ErrorScreen';

type Step = 'loading' | 'waiting' | 'incall' | 'postcall' | 'error';

interface RoomData {
  id: string;
  roomCode: string;
  status: string;
  scheduledAt: string;
  doctorName: string;
  doctorSpecialty: string;
  patientName: string;
  iceServers: RTCIceServer[];
}

const API_BASE = import.meta.env.VITE_API_BASE || '';

function extractToken(): string | null {
  const match = window.location.pathname.match(/\/consulta\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export default function App() {
  const [step, setStep] = useState<Step>('loading');
  const [room, setRoom] = useState<RoomData | null>(null);
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);

  const token = extractToken();

  useEffect(() => {
    if (!token) {
      setError('Link inválido');
      setStep('error');
      return;
    }

    fetch(`${API_BASE}/api/teleconsultation/room/${token}`)
      .then(async (res) => {
        if (res.status === 410) {
          setError('Esta consulta já foi finalizada.');
          setStep('error');
          return;
        }
        if (!res.ok) {
          setError('Sala não encontrada. Verifique o link.');
          setStep('error');
          return;
        }
        const data: RoomData = await res.json();
        setRoom(data);

        if (data.status === 'in_progress') {
          // Doctor already admitted, go straight to call
          setStep('incall');
        } else {
          setStep('waiting');
        }
      })
      .catch(() => {
        setError('Erro ao carregar a sala. Tente novamente.');
        setStep('error');
      });
  }, [token]);

  async function handleJoin() {
    if (!token || !room) return;
    try {
      const res = await fetch(`${API_BASE}/api/teleconsultation/room/${token}/join`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Erro ao entrar na sala');
      const data = await res.json();
      // Update room with fresh iceServers if provided
      setRoom((prev) => prev ? { ...prev, roomCode: data.roomCode, iceServers: data.iceServers } : prev);
      setStep('incall');
    } catch {
      setError('Não foi possível entrar na sala. Tente novamente.');
      setStep('error');
    }
  }

  function handleCallEnd(durationSec: number) {
    setDuration(durationSec);
    setStep('postcall');
  }

  if (step === 'loading') return <Loading text="Carregando sua consulta..." />;
  if (step === 'error') return <ErrorScreen message={error} />;

  if (step === 'waiting' && room) {
    return <WaitingRoom room={room} onJoin={handleJoin} />;
  }

  if (step === 'incall' && room) {
    return (
      <InCall
        roomCode={room.roomCode}
        iceServers={room.iceServers}
        onEnd={handleCallEnd}
      />
    );
  }

  if (step === 'postcall') {
    return <PostCall doctorName={room?.doctorName || 'Médico'} duration={duration} />;
  }

  return <Loading text="Carregando..." />;
}
