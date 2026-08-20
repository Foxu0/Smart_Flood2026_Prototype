import express from 'express';
import { prisma } from '../db.js';

const router = express.Router();

// GET /api/v1/events — Returns last 20 system events
router.get('/', async (req, res) => {
  try {
    const { limit = 20, severity } = req.query;

    const where = severity ? { severity } : {};

    const events = await prisma.systemEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: Math.min(parseInt(limit), 100),
    });

    res.json({ success: true, count: events.length, data: events });
  } catch (err) {
    console.error('[GET /events]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

export default router;
