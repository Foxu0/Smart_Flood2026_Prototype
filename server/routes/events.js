import express from 'express';
import { prisma } from '../db.js';

const router = express.Router();

export const memoryEvents = [
  {
    id: 1,
    createdAt: new Date().toISOString(),
    timestamp: new Date().toISOString(),
    event_code: 'SYS_INIT',
    eventCode: 'SYS_INIT',
    message: 'SmartFlood Early Warning System online and initialized.',
    severity: 'INFO',
  }
];

// GET /api/v1/events — Returns last 20 system events
router.get('/', async (req, res) => {
  try {
    const { limit = 20, severity } = req.query;

    const where = severity ? { severity } : {};

    let mappedEvents = [];
    try {
      const events = await prisma.systemEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(parseInt(limit), 100),
      });

      mappedEvents = events.map(e => ({
        ...e,
        timestamp: e.createdAt,
        event_code: e.eventCode,
      }));
    } catch (_dbErr) {
      mappedEvents = memoryEvents.slice(0, Math.min(parseInt(limit), 100));
    }

    res.json({ success: true, count: mappedEvents.length, data: mappedEvents });
  } catch (err) {
    console.error('[GET /events]', err);
    res.json({ success: true, count: memoryEvents.length, inMemory: true, data: memoryEvents });
  }
});

export default router;
