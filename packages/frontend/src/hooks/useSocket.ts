import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/authStore';

const WS_URL = import.meta.env['VITE_WS_URL'] ?? 'ws://localhost:4000';

export function useSocket(clientId: string | undefined, onAlert: (alert: unknown) => void): void {
  const socketRef = useRef<Socket | null>(null);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated || !clientId) return;

    const socket = io(WS_URL, {
      auth: { token: useAuthStore.getState().accessToken },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('subscribe:alerts', clientId);
    });

    socket.on('alert:new', (data: unknown) => {
      onAlert(data);
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, clientId, onAlert]);
}
