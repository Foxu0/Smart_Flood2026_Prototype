import express from 'express';
import { prisma } from '../db.js';
import { broadcast } from '../websocket.js';
import { buildHistoryBuffer, getPrediction, runPredictionInference } from '../services/dlService.js';
import { purgeOldData } from '../services/retentionService.js';
import { broadcastEmailAlert } from '../services/emailService.js';
import { recordPrediction, recordActualAndEvaluate, getEvaluationMetrics } from '../services/aiEvaluationService.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Physical sensor constants ────────────────────────────────────────────────
const MOUNT_HEIGHT_CM  = parseFloat(process.env.SENSOR_MOUNT_HEIGHT_CM  ?? 180);  // cm above riverbed
const BLIND_SPOT_CM    = parseFloat(process.env.SENSOR_BLIND_SPOT_CM    ?? 25);   // JSN-SR04T min range

// ── Default alert thresholds (overridable via SystemSetting) ─────────────────
const DEFAULT_THRESHOLDS = {
  level1_watch:  1.0,
  level2_alarm:  1.4,
  level3_danger: 1.6,
};

async function getThresholds() {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: { key_name: { in: ['level1_watch', 'level2_alarm', 'level3_danger'] } },
    });
    const overrides = {};
    settings.forEach((s) => { overrides[s.key_name] = parseFloat(s.value); });
    return { ...DEFAULT_THRESHOLDS, ...overrides };
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

// ── POST /api/v1/telemetry ───────────────────────────────────────────────────
// Accepts both the new ESP32 native field names and the legacy snake_case format.
//
// ESP32 native payload:
//   { rawDistance, rainTips, batteryVoltage, wifiRssi, uptime, relayState }
//
// Legacy / direct payload:
//   { water_level_m, rainfall_rate, raw_distance_cm, tip_count, rssi_dbm,
//     supply_voltage, uptime_sec, sensor_status }
// ---------------------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const body = req.body;
    const now  = new Date();

    // ── 1. Resolve raw distance ────────────────────────────────────────────
    // ESP32 sends centimetres from sensor face to water surface.
    const rawDistance = body.rawDistance ?? body.raw_distance_cm ?? null;

    // ── 2. Compute water level ─────────────────────────────────────────────
    // water_level_m = (MOUNT_HEIGHT_CM - rawDistance) / 100, clamped ≥ 0
    let water_level_m;
    if (body.water_level_m != null) {
      // Legacy direct format — accept as-is
      water_level_m = parseFloat(body.water_level_m);
    } else if (rawDistance != null) {
      water_level_m = Math.max(0, (MOUNT_HEIGHT_CM - parseFloat(rawDistance)) / 100);
      water_level_m = parseFloat(water_level_m.toFixed(3));
    } else {
      return res.status(400).json({
        error: 'Missing required field: rawDistance (cm) or water_level_m (m)',
      });
    }

    const raw_distance_cm = rawDistance != null
      ? parseFloat(rawDistance)
      : parseFloat(((MOUNT_HEIGHT_CM - water_level_m * 100)).toFixed(1));

    // ── 3. Map remaining ESP32 fields ─────────────────────────────────────────
    const rssi_dbm       = parseInt(body.wifiRssi        ?? body.rssi_dbm       ?? -65);
    const supply_voltage = parseFloat(body.batteryVoltage ?? body.supply_voltage ?? body.batteryLevel ?? 12.0);
    const uptime_sec     = parseInt(body.uptime           ?? body.uptime_sec     ?? 0);
    const relay_state    = body.relayState != null ? Boolean(body.relayState) : null;

    // ── 5. Determine sensor status ─────────────────────────────────────────
    const sensor_status = raw_distance_cm <= BLIND_SPOT_CM
      ? 'BLIND_SPOT'
      : (body.sensor_status ?? body.sensorStatus ?? 'OK');

    // ── 6. Persist telemetry log ───────────────────────────────────────────
    const log = await prisma.telemetryLog.create({
      data: {
        waterLevelM: water_level_m,
        rawDistanceCm: raw_distance_cm,
        rssiDbm: rssi_dbm,
        supplyVoltageV: supply_voltage,
        uptimeSec: uptime_sec,
        sensorStatus: sensor_status,
      },
    });

    // Evaluate actual reading against past predictions
    recordActualAndEvaluate(log);

    // ── 7. Evaluate thresholds → auto event log ────────────────────────────
    const thresholds = await getThresholds();
    let eventCode = null;
    let eventMsg  = null;
    let severity  = 'INFO';

    if (water_level_m >= thresholds.level3_danger) {
      eventCode = 'ALERT_L3';
      eventMsg  = `ALERT_L3: EMERGENCY — Water level critical at ${water_level_m.toFixed(2)} m. Immediate evacuation required.`;
      severity  = 'CRITICAL';
    } else if (water_level_m >= thresholds.level2_alarm) {
      eventCode = 'ALERT_L2';
      eventMsg  = `ALERT_L2: WARNING — Siren alarm threshold reached at ${water_level_m.toFixed(2)} m.`;
      severity  = 'WARNING';
    } else if (water_level_m >= thresholds.level1_watch) {
      eventCode = 'ALERT_L1';
      eventMsg  = `ALERT_L1: ADVISORY — Water level rising at ${water_level_m.toFixed(2)} m. Monitor closely.`;
      severity  = 'NOTICE';
    } else if (sensor_status === 'BLIND_SPOT') {
      eventCode = 'SENSOR_BLIND_SPOT';
      eventMsg  = `SENSOR_BLIND_SPOT: JSN-SR04T blind spot reached (${raw_distance_cm} cm <= ${BLIND_SPOT_CM} cm). Max depth may be exceeded.`;
      severity  = 'WARNING';
    }

    let event = null;
    if (eventCode) {
      event = await prisma.systemEvent.create({
        data: {
          eventCode,
          message: eventMsg,
          severity,
          telemetryLogId: log.id,
        },
      });
    }

    // ── 8. Build history buffer for inline LSTM inference ─────────────────
    // Fetch last 5 DB records + the new reading = sliding window of 6
    let projection = null;
    try {
      const recentLogs = await prisma.telemetryLog.findMany({
        orderBy: { recordedAt: 'desc' },
        take: 5,
        select: { waterLevelM: true },
      });

      // Combine: older records first, newest (current) last
      const chronological = [
        ...([...recentLogs].map(r => ({ water_level_m: r.waterLevelM })).reverse()),
        { water_level_m },
      ];

      const historyBuffer = buildHistoryBuffer(chronological);
      projection = await getPrediction(historyBuffer);
      if (projection) {
        recordPrediction(projection);
      }
    } catch (inferErr) {
      console.error('[POST /telemetry] Inference error:', inferErr.message);
    }

    // ── 9. Build alert status object for frontend ─────────────────────────
    const alertStatus = {
      level: water_level_m >= thresholds.level3_danger ? 3
           : water_level_m >= thresholds.level2_alarm  ? 2
           : water_level_m >= thresholds.level1_watch  ? 1
           : 0,
      thresholds,
      eventCode,
    };

    // ── 10. Broadcast over WebSocket ──────────────────────────────────────
    broadcast({
      type: 'TELEMETRY',
      data: {
        ...log,
        relay_state,
        water_level_m,
        raw_distance_cm,
        mount_height_cm: MOUNT_HEIGHT_CM,
        blind_spot_warning: sensor_status === 'BLIND_SPOT',
      },
    });

    if (event)       broadcast({ type: 'EVENT',        data: event });
    if (projection)  broadcast({ type: 'PROJECTION',   data: projection });
    broadcast({      type: 'ALERT_STATUS', data: alertStatus });
    broadcast({      type: 'AI_EVALUATION', data: getEvaluationMetrics() });

    // ── 11. Trigger Email Emergency Broadcast on Level 2+ (with anti-spam cooldown) ──
    if (alertStatus.level >= 2) {
      const alertTitle = alertStatus.level === 3 ? '🚨 LEVEL 3 EMERGENCY ALERT' : '⚠️ LEVEL 2 WARNING ALARM';
      const alertBody  = alertStatus.level === 3
        ? `EMERGENCY: Water level reached ${water_level_m.toFixed(2)}m. Immediate evacuation required in Lower Antipolo.`
        : `WARNING: Water level reached ${water_level_m.toFixed(2)}m. Prepare for potential evacuation.`;

      broadcastEmailAlert({
        title: alertTitle,
        message: alertBody,
        level: alertStatus.level,
        waterLevelM: water_level_m,
        source: 'AUTOMATED_SENSOR',
        triggerLogId: log.id,
      }).catch(err => console.error('[POST /telemetry] Email Alert error:', err.message));
    }

    const aiEvaluation = getEvaluationMetrics();
    res.status(201).json({ success: true, log, event, projection, alertStatus, aiEvaluation });
  } catch (err) {
    console.error('[POST /telemetry]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ── GET /api/v1/telemetry/projection ─────────────────────────────────────────
// Returns latest MLProjection row; triggers a fresh DB-backed inference if stale.
router.get('/projection', async (req, res) => {
  try {
    const latest = await prisma.mLProjection.findFirst({
      orderBy: { generatedAt: 'desc' },
    });

    if (!latest) {
      // No projection yet — run one on demand
      const fresh = await runPredictionInference();
      if (!fresh) return res.json({ success: true, data: null, message: 'No telemetry data available for projection.' });
      return res.json({ success: true, data: fresh });
    }

    res.json({ success: true, data: latest });
  } catch (err) {
    console.error('[GET /telemetry/projection]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ── GET /api/v1/telemetry/latest ─────────────────────────────────────────────
router.get('/latest', async (req, res) => {
  try {
    const latest = await prisma.telemetryLog.findFirst({
      orderBy: { recordedAt: 'desc' },
    });

    if (!latest) return res.json({ success: true, data: null, message: 'No telemetry data recorded yet.' });

    // 15-minute surge rate
    const fifteenMinsAgo = new Date(latest.recordedAt.getTime() - 15 * 60 * 1000);
    const baseline = await prisma.telemetryLog.findFirst({
      where:   { recordedAt: { lte: fifteenMinsAgo } },
      orderBy: { recordedAt: 'desc' },
    });

    const surgeRate_m_per_hour = baseline
      ? parseFloat(((latest.waterLevelM - baseline.waterLevelM) * 4).toFixed(3))
      : null;

    res.json({
      success: true,
      data: {
        ...latest,
        // Backward-compatible properties
        timestamp: latest.recordedAt,
        water_level_m: latest.waterLevelM,
        raw_distance_cm: latest.rawDistanceCm,
        supply_voltage: latest.supplyVoltageV,
        sensor_status: latest.sensorStatus,
        surgeRate_m_per_hour,
        blind_spot_warning: latest.rawDistanceCm <= BLIND_SPOT_CM,
        mount_height_cm: MOUNT_HEIGHT_CM,
        thresholds: await getThresholds(),
      },
    });
  } catch (err) {
    console.error('[GET /telemetry/latest]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ── GET /api/v1/telemetry/history ────────────────────────────────────────────
router.get('/history', async (req, res) => {
  try {
    const { range, from, to, limit = 100 } = req.query;
    const where = {};
    const now   = new Date();

    if (range) {
      const MAP = { '30m': 30, '1h': 60, '6h': 360, '24h': 1440 };
      let minutes = MAP[range] ?? 30;
      if (!MAP[range]) {
        if (range.endsWith('m')) minutes = parseInt(range);
        else if (range.endsWith('h')) minutes = parseInt(range) * 60;
        else if (range.endsWith('d')) minutes = parseInt(range) * 1440;
      }
      where.recordedAt = { gte: new Date(now.getTime() - minutes * 60 * 1000) };
    } else if (from || to) {
      where.recordedAt = {};
      if (from) where.recordedAt.gte = new Date(from);
      if (to)   where.recordedAt.lte = new Date(to);
    }

    const logs = await prisma.telemetryLog.findMany({
      where,
      orderBy: { recordedAt: 'asc' },
      take: Math.min(parseInt(limit), 1000),
    });

    const mappedLogs = logs.map(row => ({
      ...row,
      timestamp: row.recordedAt,
      water_level_m: row.waterLevelM,
      raw_distance_cm: row.rawDistanceCm,
      supply_voltage: row.supplyVoltageV,
      sensor_status: row.sensorStatus,
    }));

    res.json({ success: true, count: mappedLogs.length, data: mappedLogs });
  } catch (err) {
    console.error('[GET /telemetry/history]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ── GET /api/v1/telemetry/export/csv ─────────────────────────────────────────
router.get('/export/csv', async (req, res) => {
  try {
    const { from, to, limit = 1000 } = req.query;
    const where = {};
    if (from || to) {
      where.recordedAt = {};
      if (from) where.recordedAt.gte = new Date(from);
      if (to)   where.recordedAt.lte = new Date(to);
    }

    const logs = await prisma.telemetryLog.findMany({
      where,
      orderBy: { recordedAt: 'asc' },
      take: Math.min(parseInt(limit), 5000),
    });

    const headers = [
      'id', 'recordedAt', 'waterLevelM', 'rawDistanceCm',
      'rssiDbm', 'supplyVoltageV', 'uptimeSec', 'sensorStatus',
    ];

    const csvRows = [
      'ID,Recorded At,Water Level (m),Raw Distance (cm),RSSI (dBm),Supply Voltage (V),Uptime (s),Sensor Status',
      ...logs.map((row) =>
        headers.map((h) => {
          const val = row[h];
          return val instanceof Date ? val.toISOString() : (val ?? '');
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

// ── POST /api/v1/telemetry/purge ─────────────────────────────────────────────
// Admin-authenticated endpoint to trigger database log purge older than N days.
// Body: { days?: number } (default: 30 days)
router.post('/purge', authMiddleware, async (req, res) => {
  try {
    const days = parseInt(req.body.days) || 30;
    const stats = await purgeOldData(days);
    res.json({ success: true, ...stats });
  } catch (err) {
    console.error('[POST /telemetry/purge]', err);
    res.status(500).json({ error: 'Failed to purge database logs', detail: err.message });
  }
});

export default router;
