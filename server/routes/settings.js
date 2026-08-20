import express from 'express';
import { prisma } from '../db.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/v1/settings — Get all system settings
router.get('/', async (req, res) => {
  try {
    const settings = await prisma.systemSetting.findMany({
      orderBy: { key_name: 'asc' },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key_name, s.value]));
    res.json({ success: true, data: map });
  } catch (err) {
    console.error('[GET /settings]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// POST /api/v1/settings — Upsert system settings (🔒 Admin only)
// Body: { level1_advisory?: float, level2_siren?: float, level3_danger?: float, ... }
router.post('/', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    
    // Normalize alias key names (level1_advisory -> level1_watch, level2_siren -> level2_alarm)
    const normalized = {};
    if (body.level1_advisory !== undefined) normalized.level1_watch = body.level1_advisory;
    if (body.level1_watch !== undefined) normalized.level1_watch = body.level1_watch;
    
    if (body.level2_siren !== undefined) normalized.level2_alarm = body.level2_siren;
    if (body.level2_alarm !== undefined) normalized.level2_alarm = body.level2_alarm;
    
    if (body.level3_danger !== undefined) normalized.level3_danger = body.level3_danger;

    // Include any other settings keys
    Object.keys(body).forEach((k) => {
      if (!['level1_advisory', 'level1_watch', 'level2_siren', 'level2_alarm', 'level3_danger'].includes(k)) {
        normalized[k] = body[k];
      }
    });

    const entries = Object.entries(normalized);
    if (entries.length === 0) {
      return res.status(400).json({ error: 'Request body must contain at least one setting key-value pair.' });
    }

    const results = await Promise.all(
      entries.map(([key_name, value]) =>
        prisma.systemSetting.upsert({
          where: { key_name },
          update: { value: String(value) },
          create: { key_name, value: String(value) },
        })
      )
    );

    res.json({ success: true, updated: results.length, data: results });
  } catch (err) {
    console.error('[POST /settings]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

export default router;
