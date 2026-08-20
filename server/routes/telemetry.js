import express from 'express';
import { prisma } from '../db.js';
import { broadcast } from '../websocket.js';
import { runPredictionInference } from '../services/dlService.js';

const router = express.Router();

// Alert thresholds (can be overridden via SystemSetting)
const THRESHOLDS = {
  level1_watch: 1.0,
  level2_alarm: 1.4,
  level3_danger: 1.6,
  blind_spot_cm: 25,
};

async function getThresholds() {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key_name: { in: ['level1_watch', 'level2_alarm', 'level3_danger'] } },
    });
    const overrides = {};
    settings.forEach((s) => { overrides[s.key_name] = parseFloat(s.value); });
    return { ...THRESHOLDS, ...overrides };
  } catch {
    return THRESHOLDS;
  }
}

// POST /api/v1/telemetry — Ingest ESP32 payload
router.post('/', async (req, res) => {
  try {
    // Extract values supporting both snake_case (schema) and camelCase (test payload)
    const water_level_m = req.body.water_level_m ?? req.body.waterLevel;
    const raw_distance_cm = req.body.raw_distance_cm ?? req.body.rawDistanceCm ?? Math.round((1.8 - (water_level_m ?? 1.0)) * 100);
    const rainfall_rate = req.body.rainfall_rate ?? req.body.rainfallRate ?? 0;
    const tip_count = req.body.tip_count ?? req.body.tipCount ?? 0;
    const rssi_dbm = req.body.rssi_dbm ?? req.body.rssiDbm ?? -65;
    const supply_voltage = req.body.supply_voltage ?? req.body.supplyVoltage ?? req.body.batteryLevel ?? 12.0;
    const uptime_sec = req.body.uptime_sec ?? req.body.uptimeSec ?? 0;
    const sensor_status = req.body.sensor_status ?? req.body.sensorStatus ?? 'OK';

    // Validate required fields
    if (water_level_m == null) {
      return res.status(400).json({ error: 'Missing required telemetry field: water_level_m (or waterLevel)' });
    }

    // Determine sensor status based on blind spot
    const effectiveSensorStatus = raw_distance_cm <= THRESHOLDS.blind_spot_cm
      ? 'BLIND_SPOT'
      : sensor_status;

    // Save telemetry log
    const log = await prisma.telemetryLog.create({
      data: {
        water_level_m: parseFloat(water_level_m),
        raw_distance_cm: parseFloat(raw_distance_cm),
        rainfall_rate: parseFloat(rainfall_rate ?? 0),
        tip_count: parseInt(tip_count),
        rssi_dbm: parseInt(rssi_dbm),
        supply_voltage: parseFloat(supply_voltage ?? 0),
        uptime_sec: parseInt(uptime_sec ?? 0),
        sensor_status: effectiveSensorStatus,
      },
    });

    // Auto-generate SystemEvent if thresholds exceeded
    const thresholds = await getThresholds();
    const level = parseFloat(water_level_m);
    let eventCode = null;
    let eventMsg = null;
    let severity = 'INFO';

    if (level >= thresholds.level3_danger) {
      eventCode = 'ALERT_L3';
      eventMsg = `ALERT_L3: EMERGENCY — Water level critical (${level.toFixed(2)} m). Immediate evacuation required.`;
      severity = 'CRITICAL';
    } else if (level >= thresholds.level2_alarm) {
      eventCode = 'ALERT_L2';
      eventMsg = `ALERT_L2: Siren triggered — Water level alarm threshold reached (${level.toFixed(2)} m).`;
      severity = 'WARNING';
    } else if (level >= thresholds.level1_watch) {
      eventCode = 'ALERT_L1';
      eventMsg = `ALERT_L1: Advisory watch — Water level rising (${level.toFixed(2)} m). Monitor closely.`;
      severity = 'NOTICE';
    } else if (effectiveSensorStatus === 'BLIND_SPOT') {
      eventCode = 'SENSOR_BLIND_SPOT';
      eventMsg = `SENSOR_BLIND_SPOT: JSN-SR04T blind spot reached (distance: ${raw_distance_cm} cm ≤ 25 cm). Max depth may be exceeded.`;
      severity = 'WARNING';
    }

    let event = null;
    if (eventCode) {
      event = await prisma.systemEvent.create({
        data: { event_code: eventCode, message: eventMsg, severity },
      });
    }

    // Trigger Deep Learning / SurgeRate Inference
    const projection = await runPredictionInference();

    // Broadcast over WebSocket
    broadcast({ type: 'TELEMETRY', data: log });
    if (event) broadcast({ type: 'EVENT', data: event });
    if (projection) broadcast({ type: 'PROJECTION', data: projection });

    res.status(201).json({ success: true, log, event, projection });
  } catch (err) {
    console.error('[POST /telemetry]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// GET /api/v1/telemetry/projection — Returns latest MLProjection entry from database
router.get('/projection', async (req, res) => {
  try {
    const latest = await prisma.mLProjection.findFirst({
      orderBy: { timestamp: 'desc' },
    });

    if (!latest) {
      return res.status(404).json({ success: false, error: 'No ML projection found' });
    }

    res.json({ success: true, data: latest });
  } catch (err) {
    console.error('[GET /telemetry/projection]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// GET /api/v1/telemetry/latest — Returns latest reading + 15-minute surge rate
router.get('/latest', async (req, res) => {
  try {
    const latest = await prisma.telemetryLog.findFirst({
      orderBy: { timestamp: 'desc' },
    });

    if (!latest) return res.status(404).json({ error: 'No telemetry data found' });

    // Calculate 15-minute surge rate
    const fifteenMinsAgo = new Date(latest.timestamp.getTime() - 15 * 60 * 1000);
    const baseline = await prisma.telemetryLog.findFirst({
      where: { timestamp: { lte: fifteenMinsAgo } },
      orderBy: { timestamp: 'desc' },
    });

    const surgeRate_m_per_hour = baseline
      ? parseFloat(((latest.water_level_m - baseline.water_level_m) * 4).toFixed(3))
      : null;

    const blind_spot_warning = latest.raw_distance_cm <= THRESHOLDS.blind_spot_cm;

    res.json({
      success: true,
      data: {
        ...latest,
        surgeRate_m_per_hour,
        blind_spot_warning,
        thresholds: await getThresholds(),
      },
    });
  } catch (err) {
    console.error('[GET /telemetry/latest]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// GET /api/v1/telemetry/history — Returns logs filtered by time range (30m, 1h, 6h, 24h, custom)
router.get('/history', async (req, res) => {
  try {
    const { range, from, to, limit = 100 } = req.query;

    const where = {};
    const now = new Date();

    if (range) {
      let durationMs = 30 * 60 * 1000; // default 30m
      if (range === '30m') durationMs = 30 * 60 * 1000;
      else if (range === '1h') durationMs = 60 * 60 * 1000;
      else if (range === '6h') durationMs = 6 * 60 * 60 * 1000;
      else if (range === '24h') durationMs = 24 * 60 * 60 * 1000;
      else if (range.endsWith('m')) durationMs = parseInt(range) * 60 * 1000;
      else if (range.endsWith('h')) durationMs = parseInt(range) * 60 * 60 * 1000;
      else if (range.endsWith('d')) durationMs = parseInt(range) * 24 * 60 * 60 * 1000;

      where.timestamp = { gte: new Date(now.getTime() - durationMs) };
    } else if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(from);
      if (to) where.timestamp.lte = new Date(to);
    }

    const logs = await prisma.telemetryLog.findMany({
      where,
      orderBy: { timestamp: 'asc' }, // ascending order for chart timeline
      take: Math.min(parseInt(limit), 1000),
    });

    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    console.error('[GET /telemetry/history]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// GET /api/v1/telemetry/export/csv — Download CSV of telemetry logs
router.get('/export/csv', async (req, res) => {
  try {
    const { from, to, limit = 1000 } = req.query;

    const where = {};
    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(from);
      if (to) where.timestamp.lte = new Date(to);
    }

    const logs = await prisma.telemetryLog.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      take: Math.min(parseInt(limit), 5000),
    });

    const headers = [
      'id', 'timestamp', 'water_level_m', 'raw_distance_cm',
      'rainfall_rate', 'tip_count', 'rssi_dbm', 'supply_voltage',
      'uptime_sec', 'sensor_status',
    ];

    const csvRows = [
      headers.join(','),
      ...logs.map((row) =>
        headers.map((h) => {
          const val = row[h];
          return val instanceof Date ? val.toISOString() : val ?? '';
        }).join(',')
      ),
    ];

    const filename = `SmartFlood_Telemetry_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvRows.join('\n'));
  } catch (err) {
    console.error('[GET /telemetry/export/csv]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

export default router;
