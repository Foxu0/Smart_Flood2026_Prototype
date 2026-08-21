import express from 'express';
import { prisma } from '../db.js';
import { broadcast } from '../websocket.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── POST /api/v1/control/siren ───────────────────────────────────────────────
// Authenticated siren relay control.
// Body: { action: "TEST" | "MUTE" | "TRIGGER" | "ENABLE" | "DISABLE", durationMs?: number }
//
// Action semantics:
//   TEST     — 5-second acoustic relay test (manual, short burst)
//   MUTE     — Silence a currently active siren (manual override)
//   TRIGGER  — Activate siren due to automated threshold breach
//   ENABLE   — Manually turn siren ON (alias for persistent activation)
//   DISABLE  — Turn siren OFF (alias for MUTE without critical log)
// ---------------------------------------------------------------------------
router.post('/siren', authMiddleware, async (req, res) => {
  try {
    const { action, durationMs } = req.body;
    const operator = req.operator?.username || 'EOC Operator';

    const validActions = ['TEST', 'MUTE', 'TRIGGER', 'ENABLE', 'DISABLE'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: `Invalid action. Must be one of: ${validActions.join(', ')}`,
      });
    }

    let sirenState = 'OFF';
    let eventCode  = '';
    let eventMsg   = '';
    let severity   = 'INFO';
    let testDurationMs = null;

    switch (action) {
      case 'TEST':
        sirenState     = 'TEST';
        testDurationMs = typeof durationMs === 'number' && durationMs > 0
          ? Math.min(durationMs, 30000)  // cap at 30 s for safety
          : 5000;
        eventCode = 'SIREN_TEST';
        eventMsg  = `SIREN_TEST: Manual ${testDurationMs / 1000}-second acoustic relay test triggered by ${operator}.`;
        severity  = 'INFO';
        break;

      case 'MUTE':
      case 'DISABLE':
        sirenState = 'MUTED';
        eventCode  = action === 'MUTE' ? 'SIREN_MUTE' : 'SIREN_DISABLE';
        eventMsg   = `${eventCode}: Acoustic siren silenced (Manual Override) by ${operator}.`;
        severity   = 'WARNING';
        break;

      case 'TRIGGER':
        sirenState = 'TRIGGERED';
        eventCode  = 'SIREN_TRIGGER';
        eventMsg   = `SIREN_TRIGGER: Automatic threshold breach — siren activated by system alert. Acknowledged by ${operator}.`;
        severity   = 'CRITICAL';
        break;

      case 'ENABLE':
        sirenState = 'ON';
        eventCode  = 'SIREN_ENABLE';
        eventMsg   = `SIREN_ENABLE: Siren manually activated by ${operator}.`;
        severity   = 'WARNING';
        break;
    }

    // ── Persist siren state in SystemSetting ──────────────────────────────
    await prisma.systemSetting.upsert({
      where:  { key_name: 'siren_state' },
      update: { value: sirenState },
      create: { key_name: 'siren_state', value: sirenState },
    });

    // ── Log the operator action as a SystemEvent ───────────────────────────
    const event = await prisma.systemEvent.create({
      data: { event_code: eventCode, message: eventMsg, severity },
    });

    // ── Build the broadcast payload ────────────────────────────────────────
    const payload = {
      action,
      sirenState,
      operator,
      event,
      ...(testDurationMs != null ? { testDurationMs } : {}),
    };

    // Broadcast siren state change to all connected WebSocket clients
    broadcast({ type: 'SIREN_CONTROL', data: payload });

    res.json({ success: true, ...payload });
  } catch (err) {
    console.error('[POST /control/siren]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ── GET /api/v1/control/siren ─────────────────────────────────────────────────
// Returns the current persisted siren state (for ESP32 to poll).
router.get('/siren', async (req, res) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key_name: 'siren_state' },
    });
    const sirenState = setting?.value ?? 'OFF';
    res.json({ success: true, sirenState });
  } catch (err) {
    console.error('[GET /control/siren]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

export default router;
