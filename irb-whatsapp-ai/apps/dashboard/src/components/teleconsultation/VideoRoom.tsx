import { useEffect, useRef, useState } from 'react';

interface Props {
  roomCode: string;
  iceServers: RTCIceServer[];
}

export default function VideoRoom({ roomCode, iceServers }: Props) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let disposed = false;

    async function init() {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setConnected(true);
        }
      };

      // Signaling WebSocket
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const apiBase = import.meta.env.VITE_API_BASE;
      const wsHost = apiBase ? new URL(apiBase).host : window.location.host;
      const ws = new WebSocket(`${wsProtocol}//${wsHost}/api/teleconsultation/signal/${roomCode}`);
      wsRef.current = ws;

      const sendSignal = (data: object) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(data));
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({ type: 'ice-candidate', candidate: event.candidate });
        }
      };

      ws.onopen = () => {
        sendSignal({ type: 'join', role: 'doctor', peerId: `doctor-${Date.now()}` });
      };

      ws.onmessage = async (event) => {
        if (disposed) return;
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'offer': {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal({ type: 'answer', sdp: answer });
            break;
          }
          case 'answer': {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            break;
          }
          case 'ice-candidate': {
            if (data.candidate) {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
            break;
          }
          case 'peer-joined': {
            if (data.role === 'patient') {
              // Patient joined, doctor creates offer
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              sendSignal({ type: 'offer', sdp: offer });
            }
            break;
          }
        }
      };
    }

    init().catch(console.error);

    return () => {
      disposed = true;
      pcRef.current?.close();
      wsRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [roomCode, iceServers]);

  return (
    <div className="w-full h-full bg-gray-900 relative">
      {/* Remote video (patient) */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />

      {!connected && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <div className="w-12 h-12 border-4 border-gray-600 border-t-teal-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Aguardando paciente conectar...</p>
          </div>
        </div>
      )}

      {/* Local video (doctor, pip) */}
      <div className="absolute bottom-3 right-3 w-40 h-28 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
      </div>
    </div>
  );
}
