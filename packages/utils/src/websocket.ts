// ── WebSocket connection ──────────────────────────────────────────
export type WsEventHandler = (event: string, data: Record<string, unknown>) => void;

export function connectWebSocket(onEvent: WsEventHandler): { close: () => void } {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  function connect() {
    if (closed) return;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      onEvent('ws:status', { connected: true });
    };

    ws.onmessage = (msg) => {
      try {
        const { event, data } = JSON.parse(msg.data);
        if (event && event !== 'connected') {
          onEvent(event, data);
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = () => {
      onEvent('ws:status', { connected: false });
      if (!closed) {
        reconnectTimer = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  connect();

  return {
    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}
