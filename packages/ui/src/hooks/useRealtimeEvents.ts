import { useEffect, useRef } from 'react';
import { useAuthStore } from '../../../../modules/users/frontend/stores/authStore';

export function useRealtimeEvents() {
  const wsRef = useRef<WebSocket | null>(null);
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Dispatch custom events for modules to react to
          window.dispatchEvent(new CustomEvent('crm:realtime', { detail: data }));
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected');
      };

      return () => {
        ws.close();
        wsRef.current = null;
      };
    } catch {
      // WebSocket connection failed
    }
  }, [isAuthenticated, token]);
}
