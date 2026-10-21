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

// GET /api/v1/events — recent system events
// Query: limit (max 1000), severity, type=alerts (only ALERT_L1/2/3), from, to (ISO dates), nodeId
router.get('/', async (req, res) => {
  try {
    const { limit = 20, severity, type, from, to, nodeId } = req.query;
    const max = type === 'alerts' ? 1000 : 100;

    const where = {};
    if (severity) where.severity = severity;
    if (type === 'alerts') where.eventCode = { startsWith: 'ALERT_' };
    if (nodeId) where.nodeId = parseInt(nodeId);
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    let mappedEvents = [];
    try {
      const events = await prisma.systemEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(parseInt(limit) || 20, max),
        include: { node: { select: { nodeCode: true, name: true } } },
      });

      mappedEvents = events.map(e => ({
        ...e,
        timestamp: e.createdAt,
        event_code: e.eventCode,
      }));
    } catch (_dbErr) {
      mappedEvents = memoryEvents
        .filter(e => type !== 'alerts' || String(e.eventCode || '').startsWith('ALERT_'))
        .slice(0, Math.min(parseInt(limit) || 20, max));
    }

    res.json({ success: true, count: mappedEvents.length, data: mappedEvents });
  } catch (err) {
    console.error('[GET /events]', err);
    res.json({ success: true, count: memoryEvents.length, inMemory: true, data: memoryEvents });
  }
});

export default router;
