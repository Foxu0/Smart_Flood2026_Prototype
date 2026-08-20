import express from 'express';
import { prisma } from '../db.js';
import { broadcast } from '../websocket.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/v1/control/siren — Handle siren override actions (🔒 Admin only)
// Body: { action: "TEST" | "MUTE" | "ENABLE" | "DISABLE" }
router.post('/siren', authMiddleware, async (req, res) => {
  try {
    const { action } = req.body;
    const operator = req.operator?.username || 'EOC Operator';

    const validActions = ['TEST', 'MUTE', 'ENABLE', 'DISABLE'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: `Invalid action. Must be one of: ${validActions.join(', ')}`,
      });
    }

    let sirenState = 'OFF';
    let eventCode = '';
    let eventMsg = '';
    let severity = 'INFO';

    switch (action) {
      case 'TEST':
        sirenState = 'TEST';
        eventCode = 'SIREN_TEST';
        eventMsg = `SIREN_TEST: Manual 5-second acoustic relay test triggered by ${operator}.`;
        severity = 'INFO';
        break;
      case 'MUTE':
        sirenState = 'MUTED';
        eventCode = 'SIREN_MUTE';
        eventMsg = `SIREN_MUTE: Acoustic siren silenced (Manual Override) by ${operator}.`;
        severity = 'WARNING';
        break;
      case 'ENABLE':
        sirenState = 'ON';
        eventCode = 'SIREN_ENABLE';
        eventMsg = `SIREN_ENABLE: Siren manually activated by ${operator}.`;
        severity = 'WARNING';
        break;
      case 'DISABLE':
        sirenState = 'OFF';
        eventCode = 'SIREN_DISABLE';
        eventMsg = `SIREN_DISABLE: Siren manually deactivated by ${operator}.`;
        severity = 'INFO';
        break;
    }

    // Persist siren state in SystemSetting
    await prisma.systemSetting.upsert({
      where: { key_name: 'siren_state' },
      update: { value: sirenState },
      create: { key_name: 'siren_state', value: sirenState },
    });

    // Log the event
    const event = await prisma.systemEvent.create({
      data: { event_code: eventCode, message: eventMsg, severity },
    });

    // Broadcast siren state change over WebSocket
    broadcast({ type: 'SIREN_CONTROL', data: { action, sirenState, event } });

    res.json({ success: true, action, sirenState, event });
  } catch (err) {
    console.error('[POST /control/siren]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

export default router;
