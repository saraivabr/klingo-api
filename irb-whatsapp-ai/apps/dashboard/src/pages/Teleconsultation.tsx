import { useState, useEffect, useCallback } from 'react';
import VideoRoom from '../components/teleconsultation/VideoRoom';
import PrescriptionModal from '../components/teleconsultation/PrescriptionModal';

interface QueueRoom {
  id: string;
  roomCode: string;
  status: string;
  scheduledAt: string;
  createdAt: string;
  patientName: string | null;
  patientPhone: string | null;
  doctorName: string | null;
  doctorSpecialty: string | null;
}

interface AdmitData {
  roomCode: string;
  iceServers: RTCIceServer[];
}

const API_BASE = import.meta.env.VITE_API_BASE || '';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h`;
}

export default function Teleconsultation() {
  const [queue, setQueue] = useState<QueueRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState<(QueueRoom & AdmitData) | null>(null);
  const [showPrescription, setShowPrescription] = useState(false);
  const [notes, setNotes] = useState('');

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/teleconsultation/queue`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setQueue(data.rooms);
      }
    } catch (err) {
      console.error('Failed to fetch queue:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll queue every 10 seconds
  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  async function handleAdmit(room: QueueRoom) {
    try {
      const res = await fetch(`${API_BASE}/api/teleconsultation/${room.id}/admit`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to admit');
      const data: AdmitData = await res.json();
      setActiveRoom({ ...room, ...data });
    } catch (err) {
      console.error('Admit error:', err);
      alert('Erro ao admitir paciente');
    }
  }

  async function handleEndCall() {
    if (!activeRoom) return;
    try {
      await fetch(`${API_BASE}/api/teleconsultation/${activeRoom.id}/end`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ notes }),
      });
      setActiveRoom(null);
      setNotes('');
      fetchQueue();
    } catch (err) {
      console.error('End call error:', err);
    }
  }

  const waitingRooms = queue.filter((r) => r.status === 'waiting');
  const inProgressRooms = queue.filter((r) => r.status === 'in_progress');

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left panel: Queue */}
      <div className="w-80 border-r border-slate-200 bg-white flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Teleconsulta</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {waitingRooms.length} aguardando · {inProgressRooms.length} em atendimento
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-sm text-slate-400">Carregando...</div>
          )}

          {!loading && queue.length === 0 && (
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-slate-500">Nenhum paciente na fila</p>
              <p className="text-xs text-slate-400 mt-1">As teleconsultas aparecerão aqui</p>
            </div>
          )}

          {/* Waiting rooms */}
          {waitingRooms.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Aguardando
              </div>
              {waitingRooms.map((room) => (
                <div
                  key={room.id}
                  className="px-4 py-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => handleAdmit(room)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                      <span className="text-sm font-medium text-slate-900">
                        {room.patientName || 'Paciente'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">{timeAgo(room.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 ml-4">
                    {room.doctorSpecialty} · {room.doctorName}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* In progress rooms */}
          {inProgressRooms.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wider">
                Em atendimento
              </div>
              {inProgressRooms.map((room) => (
                <div
                  key={room.id}
                  className="px-4 py-3 border-b border-slate-100 bg-green-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="text-sm font-medium text-slate-900">
                      {room.patientName || 'Paciente'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 ml-4">
                    {room.doctorSpecialty} · {room.doctorName}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right panel: Active call or empty state */}
      <div className="flex-1 flex flex-col bg-slate-50">
        {activeRoom ? (
          <>
            {/* Video area */}
            <div className="flex-1 relative">
              <VideoRoom
                roomCode={activeRoom.roomCode}
                iceServers={activeRoom.iceServers}
              />
            </div>

            {/* Bottom controls */}
            <div className="bg-white border-t border-slate-200 px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Notes input */}
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anotações da consulta..."
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />

                <button
                  onClick={() => setShowPrescription(true)}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition"
                >
                  Prescrever
                </button>

                <button
                  onClick={handleEndCall}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
                >
                  Encerrar
                </button>
              </div>
            </div>

            {/* Prescription modal */}
            {showPrescription && (
              <PrescriptionModal
                teleconsultationId={activeRoom.id}
                onClose={() => setShowPrescription(false)}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-slate-500 text-sm">Selecione um paciente da fila para iniciar</p>
              <p className="text-slate-400 text-xs mt-1">Clique em um paciente aguardando na lista à esquerda</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
