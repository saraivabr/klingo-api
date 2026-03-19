import { useEffect, useRef, useState, useCallback } from 'react';

interface WSMessage {
  channel: string;
  data: {
    type: string;
    payload: any;
    timestamp: string;
  };
}

// Notification sound - short beep using Web Audio API
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {}
}

// Events that should trigger a notification sound
const NOTIFY_EVENTS = ['escalation:created', 'message:received'];

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const resetUnread = useCallback(() => setUnreadCount(0), []);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 3000);
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        setLastMessage(msg);

        // Play sound for escalations and new conversations
        if (msg.data?.type && NOTIFY_EVENTS.includes(msg.data.type)) {
          playNotificationSound();
          setUnreadCount(prev => prev + 1);
        }
      } catch {}
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  return { connected, lastMessage, unreadCount, resetUnread };
}
