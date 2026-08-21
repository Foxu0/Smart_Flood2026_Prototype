import { WebSocketServer } from 'ws';

let wss = null;

// ── Last-state snapshot ───────────────────────────────────────────────────────
// Caches the most recent payload for each broadcast type so that newly
// connected clients receive an immediate state snapshot instead of waiting
// for the next sensor reading.
const lastState = {
  TELEMETRY:    null,
  PROJECTION:   null,
  SIREN_CONTROL: null,
  ALERT_STATUS:  null,
};

// Types whose last value should be cached for new-client snapshot delivery
const SNAPSHOT_TYPES = new Set(['TELEMETRY', 'PROJECTION', 'SIREN_CONTROL', 'ALERT_STATUS']);

// ── WebSocket server init ─────────────────────────────────────────────────────
export function initWebSocketServer(server) {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const clientAddr = req.socket.remoteAddress ?? 'unknown';
    console.log(`[WebSocket] Client connected: ${clientAddr}`);

    // 1. Send welcome handshake
    safeSend(ws, {
      type: 'CONNECTED',
      message: 'Connected to SmartFlood Real-Time Telemetry Stream',
      timestamp: new Date().toISOString(),
    });

    // 2. Deliver the last-known state snapshot so the dashboard renders
    //    immediately without waiting for the next sensor POST
    for (const [type, data] of Object.entries(lastState)) {
      if (data !== null) {
        safeSend(ws, { type, data });
      }
    }

    ws.on('close', () => {
      console.log(`[WebSocket] Client disconnected: ${clientAddr}`);
    });

    ws.on('error', (err) => {
      console.error(`[WebSocket] Client error (${clientAddr}):`, err.message);
    });
  });

  console.log('[WebSocket] Server initialized — ready for connections');
  return wss;
}

// ── Broadcast to all open clients ─────────────────────────────────────────────
export function broadcast(message) {
  // Update the in-memory snapshot cache for snapshotable types
  if (SNAPSHOT_TYPES.has(message.type) && message.data !== undefined) {
    lastState[message.type] = message.data;
  }

  if (!wss) return;

  const payload = JSON.stringify(message);
  let delivered = 0;

  wss.clients.forEach((client) => {
    if (client.readyState === 1 /* OPEN */) {
      client.send(payload);
      delivered++;
    }
  });

  if (delivered > 0) {
    console.log(`[WebSocket] Broadcast [${message.type}] -> ${delivered} client(s)`);
  }
}

// ── Typed convenience wrapper ─────────────────────────────────────────────────
// broadcastTyped('TELEMETRY', data) is equivalent to broadcast({ type, data })
export function broadcastTyped(type, data) {
  broadcast({ type, data });
}

// ── Utility: set last state externally (e.g. on server startup) ──────────────
export function setLastState(type, data) {
  if (SNAPSHOT_TYPES.has(type)) {
    lastState[type] = data;
  }
}

// ── Utility: retrieve current cached state snapshot (for health/debug) ───────
export function getLastState() {
  return { ...lastState };
}

// ── Internal: safe JSON send that swallows errors on closed sockets ───────────
function safeSend(ws, message) {
  try {
    if (ws.readyState === 1 /* OPEN */) {
      ws.send(JSON.stringify(message));
    }
  } catch (err) {
    console.error('[WebSocket] safeSend error:', err.message);
  }
}
