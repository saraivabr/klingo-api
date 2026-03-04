import { useState, useEffect, useRef } from 'react';
import DeviceCheck from './DeviceCheck';

interface RoomData {
  id: string;
  status: string;
  scheduledAt: string;
  doctorName: string;
  doctorSpecialty: string;
  patientName: string;
}

interface Props {
  room: RoomData;
  onJoin: () => void;
}

export default function WaitingRoom({ room, onJoin }: Props) {
  const [consent, setConsent] = useState(false);
  const [deviceOk, setDeviceOk] = useState(false);
  const [showDeviceCheck, setShowDeviceCheck] = useState(false);
  const [waitingTime, setWaitingTime] = useState(0);
  const intervalRef = useRef<number>();

  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      setWaitingTime((t) => t + 1);
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const scheduledDate = new Date(room.scheduledAt);
  const formattedDate = scheduledDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const formattedTime = scheduledDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const formatWaiting = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (showDeviceCheck) {
    return (
      <DeviceCheck
        onReady={() => {
          setDeviceOk(true);
          setShowDeviceCheck(false);
        }}
        onBack={() => setShowDeviceCheck(false)}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-irb-bg rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-irb-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Sala de Espera</h1>
          <p className="text-gray-500 text-sm mt-1">Teleconsulta IRB Prime Care</p>
        </div>

        {/* Doctor info */}
        <div className="bg-irb-bg rounded-xl p-4">
          <p className="text-sm text-gray-500">Médico</p>
          <p className="text-lg font-semibold text-gray-900">{room.doctorName}</p>
          <p className="text-sm text-irb-primary">{room.doctorSpecialty}</p>
          <div className="mt-2 pt-2 border-t border-irb-light">
            <p className="text-sm text-gray-500">{formattedDate} às {formattedTime}</p>
          </div>
        </div>

        {/* Waiting indicator */}
        <div className="text-center py-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            <span className="text-sm text-gray-600">Aguardando o médico iniciar...</span>
          </div>
          <p className="text-xs text-gray-400">Tempo de espera: {formatWaiting(waitingTime)}</p>
        </div>

        {/* Device check */}
        {!deviceOk && (
          <button
            onClick={() => setShowDeviceCheck(true)}
            className="w-full py-3 border-2 border-irb-primary text-irb-primary rounded-xl font-medium hover:bg-irb-bg transition"
          >
            Testar câmera e microfone
          </button>
        )}
        {deviceOk && (
          <div className="flex items-center gap-2 text-sm text-green-600 justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Câmera e microfone funcionando
          </div>
        )}

        {/* Consent + Join */}
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 w-4 h-4 accent-irb-primary"
            />
            <span className="text-xs text-gray-500 leading-relaxed">
              Concordo com os termos de teleconsulta. Entendo que esta consulta será realizada por videochamada e autorizo o processamento dos meus dados conforme a LGPD.
            </span>
          </label>

          <button
            onClick={onJoin}
            disabled={!consent}
            className="w-full py-4 bg-irb-primary text-white rounded-xl font-semibold text-lg hover:bg-irb-dark transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
          >
            Entrar na Consulta
          </button>
        </div>

        {/* Patient name */}
        {room.patientName && (
          <p className="text-center text-xs text-gray-400">
            Paciente: {room.patientName}
          </p>
        )}
      </div>
    </div>
  );
}
