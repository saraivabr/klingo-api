import { useState, useEffect, useRef } from 'react';

interface Props {
  onReady: () => void;
  onBack: () => void;
}

export default function DeviceCheck({ onReady, onBack }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraOk, setCameraOk] = useState(false);
  const [micOk, setMicOk] = useState(false);
  const [error, setError] = useState('');
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    async function checkDevices() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setCameraOk(stream.getVideoTracks().length > 0);
        setMicOk(stream.getAudioTracks().length > 0);
      } catch (err) {
        setError('Não foi possível acessar câmera/microfone. Verifique as permissões do navegador.');
      }
    }

    checkDevices();

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-6 space-y-6">
        <h2 className="text-lg font-bold text-gray-900 text-center">Teste de Dispositivos</h2>

        {/* Video preview */}
        <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover mirror"
            style={{ transform: 'scaleX(-1)' }}
          />
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 text-white text-sm text-center px-4">
              {error}
            </div>
          )}
        </div>

        {/* Status */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${cameraOk ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-700">Câmera {cameraOk ? 'funcionando' : 'indisponível'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${micOk ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-700">Microfone {micOk ? 'funcionando' : 'indisponível'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-3 border border-gray-300 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition"
          >
            Voltar
          </button>
          <button
            onClick={() => {
              streamRef.current?.getTracks().forEach((t) => t.stop());
              onReady();
            }}
            disabled={!cameraOk && !micOk}
            className="flex-1 py-3 bg-irb-primary text-white rounded-xl font-medium hover:bg-irb-dark transition disabled:opacity-40"
          >
            Tudo certo!
          </button>
        </div>
      </div>
    </div>
  );
}
