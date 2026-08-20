import { WebSocketServer } from 'ws';

let wss = null;

export function initWebSocketServer(server) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    console.log(`[WebSocket] Client connected from ${req.socket.remoteAddress}`);

    ws.send(JSON.stringify({
      type: 'CONNECTED',
      message: 'Connected to SmartFlood Real-Time Telemetry Stream'
    }));

    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected');
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] Client error:', err.message);
    });
  });

  console.log('[WebSocket] WebSocket Server initialized on ws://');
  return wss;
}

export function broadcast(data) {
  if (!wss) return;
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  });
}
