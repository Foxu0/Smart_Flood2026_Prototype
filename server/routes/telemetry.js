import express from 'express';
import { prisma } from '../db.js';
import { broadcast } from '../websocket.js';
import { buildHistoryBuffer, getPrediction, runPredictionInference, getModelStatus } from '../services/dlService.js';
import { getThresholds } from '../services/thresholdStore.js';
import { broadcastEmailAlert } from '../services/emailService.js';
import { requirePermission } from '../middleware/authMiddleware.js';
import { memoryEvents } from './events.js';
import { authenticateDeviceKey, touchDevice, findDefaultNode, listDevices, rememberUnassignedCode } from '../services/deviceStore.js';
import { normalizeBoardCode } from '../lib/crypto.js';
import { barangayNameById } from '../services/barangayStore.js';

export const memoryTelemetryLogs = [];
let memoryLatestProjection = null;

const router = express.Router();

// ── Physical sensor constants ────────────────────────────────────────────────
const MOUNT_HEIGHT_CM  = parseFloat(process.env.SENSOR_MOUNT_HEIGHT_CM  ?? 240);  // cm above riverbed
const BLIND_SPOT_CM    = parseFloat(process.env.SENSOR_BLIND_SPOT_CM    ?? 25);   // JSN-SR04T min range

// Alert thresholds are per board (see services/thresholdStore.js)
export { getThresholds };

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

    // ── 0. Identify the board ──────────────────────────────────────────────
    // Each board sends its own code (the one on its sticker) in the X-Device-Key header.
    // A code that is not assigned to a station yet is remembered for a few minutes, so
    // staff can add it on the Hardware page; its readings are not saved until then.
    // Posts without a code (current firmware / simulators) go to the default site
    // unless REQUIRE_DEVICE_KEY=true.
    const deviceKey = req.get('X-Device-Key') || body.deviceKey || null;
    let device = null;
    if (deviceKey) {
      device = await authenticateDeviceKey(deviceKey);
      if (!device && normalizeBoardCode(deviceKey)) {
        rememberUnassignedCode(deviceKey);
        return res.status(202).json({ status: 'NOT_ASSIGNED', message: 'Board is on. Add it on the Hardware page using the code on its sticker.' });
      }
      if (!device) return res.status(401).json({ error: 'Unknown, retired or invalid device key.' });
    } else if (process.env.REQUIRE_DEVICE_KEY === 'true') {
      return res.status(401).json({ error: 'Missing X-Device-Key header.' });
    } else {
      device = await findDefaultNode();
    }
    const mountHeightCm = device?.mountHeightCm ?? MOUNT_HEIGHT_CM;
    const inMaintenance = device?.status === 'MAINTENANCE'; // board turned Off on the Hardware page

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
      water_level_m = Math.max(0, (mountHeightCm - parseFloat(rawDistance)) / 100);
      water_level_m = parseFloat(water_level_m.toFixed(3));
    } else {
      return res.status(400).json({
        error: 'Missing required field: rawDistance (cm) or water_level_m (m)',
      });
    }

    const raw_distance_cm = rawDistance != null
      ? parseFloat(rawDistance)
      : parseFloat(((mountHeightCm - water_level_m * 100)).toFixed(1));

    // ── 3. Map remaining ESP32 fields ─────────────────────────────────────────
    const rssi_dbm       = parseInt(body.wifiRssi        ?? body.rssi_dbm       ?? -65);
    const supply_voltage = parseFloat(body.batteryVoltage ?? body.supply_voltage ?? body.batteryLevel ?? 12.0);
    const uptime_sec     = parseInt(body.uptime           ?? body.uptime_sec     ?? 0);
    const relay_state    = body.relayState != null ? Boolean(body.relayState) : null;
    const rawSpeed       = body.currentSpeed ?? body.flowSpeedMs ?? body.flow_speed_ms ?? body.current_speed_mps ?? null;
    const current_speed_mps = rawSpeed != null && !isNaN(parseFloat(rawSpeed)) ? parseFloat(rawSpeed) : null;

    // ── 5. Determine sensor status ─────────────────────────────────────────
    const sensor_status = inMaintenance
      ? 'MAINTENANCE'
      : raw_distance_cm <= BLIND_SPOT_CM
      ? 'BLIND_SPOT'
      : (body.sensor_status ?? body.sensorStatus ?? 'OK');

    // ── 6. Persist telemetry log ───────────────────────────────────────────
    // Maintain backward-compatibility with DB schemas where rainfall fields were NOT NULL
    let log;
    try {
      log = await prisma.telemetryLog.create({
        data: {
          waterLevelM: water_level_m,
          rawDistanceCm: raw_distance_cm,
          rainfallRateMmh: 0,
          tipCount: 0,
          rssiDbm: rssi_dbm,
          supplyVoltageV: supply_voltage,
          uptimeSec: uptime_sec,
          sensorStatus: sensor_status,
          flowSpeedMs: current_speed_mps,
          inMaintenance,
          nodeId: device?.id ?? null,
        },
      });
    } catch (_dbErr) {
      log = {
        id: memoryTelemetryLogs.length + 1,
        recordedAt: now,
        waterLevelM: water_level_m,
        rawDistanceCm: raw_distance_cm,
        rainfallRateMmh: 0,
        tipCount: 0,
        rssiDbm: rssi_dbm,
        supplyVoltageV: supply_voltage,
        uptimeSec: uptime_sec,
        sensorStatus: sensor_status,
        flowSpeedMs: current_speed_mps,
        inMaintenance,
        nodeId: device?.id ?? null,
      };
    }
    if (device) touchDevice(device.id, body.firmwareVersion).catch(() => {});
    memoryTelemetryLogs.unshift(log);
    if (memoryTelemetryLogs.length > 500) memoryTelemetryLogs.pop();

    // Evaluate actual reading against past predictions

    // ── 7. Evaluate thresholds → auto event log ────────────────────────────
    const thresholds = await getThresholds(device?.id);
    let eventCode = null;
    let eventMsg  = null;
    let severity  = 'INFO';

    if (inMaintenance) {
      // Board under maintenance: readings are stored but never raise alerts
    } else if (water_level_m >= thresholds.level3_danger) {
      eventCode = 'ALERT_L3';
      eventMsg  = `ALERT_L3: SPILL — Water at ${water_level_m.toFixed(2)} m has reached the spill level. Evacuate now.`;
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
      try {
        event = await prisma.systemEvent.create({
          data: {
            eventCode,
            message: eventMsg,
            severity,
            telemetryLogId: log.id,
            nodeId: device?.id ?? null,
          },
        });
      } catch (_e) {
        event = {
          id: memoryEvents.length + 1,
          createdAt: now.toISOString(),
          timestamp: now.toISOString(),
          event_code: eventCode,
          eventCode,
          message: eventMsg,
          severity,
          telemetryLogId: log.id,
        };
      }
      memoryEvents.unshift(event);
      if (memoryEvents.length > 100) memoryEvents.pop();
    }

    // ── 8. Build history buffer for inline LSTM inference ─────────────────
    // Fetch last 5 records + the new reading = sliding window of 6
    let projection = null;
    try {
      let recentLogs = [];
      try {
        recentLogs = await prisma.telemetryLog.findMany({
          where: { nodeId: device?.id ?? null, id: { not: log.id } },
          orderBy: { recordedAt: 'desc' },
          take: 5,
          select: { waterLevelM: true },
        });
      } catch (_e) {
        recentLogs = memoryTelemetryLogs
          .filter(r => r.id !== log.id && (r.nodeId ?? null) === (device?.id ?? null))
          .slice(0, 5).map(r => ({ waterLevelM: r.waterLevelM }));
      }

      // Combine: older records first, newest (current) last
      const chronological = [
        ...([...recentLogs].map(r => ({ water_level_m: r.waterLevelM })).reverse()),
        { water_level_m },
      ];

      const historyBuffer = buildHistoryBuffer(chronological);
      projection = await getPrediction(historyBuffer);
      if (projection) memoryLatestProjection = projection;
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
      maintenance: inMaintenance,
    };

    // ── 10. Broadcast over WebSocket ──────────────────────────────────────
    broadcast({
      type: 'TELEMETRY',
      data: {
        ...log,
        relay_state,
        water_level_m,
        raw_distance_cm,
        mount_height_cm: mountHeightCm,
        current_speed_mps,
        device_node_id: device?.nodeCode ?? null,
        blind_spot_warning: sensor_status === 'BLIND_SPOT',
      },
    });

    if (event)       broadcast({ type: 'EVENT',        data: event });
    if (projection)  broadcast({ type: 'PROJECTION',   data: { ...projection, nodeId: device?.id ?? null } });
    broadcast({      type: 'ALERT_STATUS', data: alertStatus });

    // ── 11. Trigger Email Broadcast on Level 1+ (with anti-spam cooldown) ──────
    // Level 1 (Advisory) → email advisory only (no siren)
    // Level 2 (Warning)  → email + siren activated on ESP32
    // Level 3 (Danger)   → email + siren activated on ESP32
    if (alertStatus.level >= 1 && !inMaintenance) {
      const alertTitle = alertStatus.level === 3
        ? 'Spill Level Reached'
        : alertStatus.level === 2
          ? 'Flood Warning Active'
          : 'Water Level Rising';
      const alertBody  = alertStatus.level === 3
        ? `SPILL LEVEL: Water reached ${water_level_m.toFixed(2)} m and may overflow the riverbank in Lower Antipolo. Evacuate now.`
        : alertStatus.level === 2
          ? `WARNING: Water level reached ${water_level_m.toFixed(2)}m. Prepare for potential evacuation.`
          : `ADVISORY: Water level at Lower Antipolo has reached ${water_level_m.toFixed(2)}m and is rising. Please stay alert and monitor further updates.`;

      broadcastEmailAlert({
        title: alertTitle,
        message: alertBody,
        level: alertStatus.level,
        waterLevelM: water_level_m,
        source: 'AUTOMATED_SENSOR',
        triggerLogId: log.id,
        nodeId: device?.id ?? null,
      }).catch(err => console.error('[POST /telemetry] Email Alert error:', err.message));
    }

    res.status(201).json({ success: true, log, event, projection, alertStatus });
  } catch (err) {
    console.error('[POST /telemetry]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ── GET /api/v1/telemetry/stations (public) ─────────────────────────────────
// Which barangays have a station, so residents can pick theirs on the public page.
// Only the name and barangay are shared — no keys or settings.
router.get('/stations', async (_req, res) => {
  try {
    const nodes = (await listDevices()).filter((n) => n.status !== 'RETIRED');
    const data = await Promise.all(nodes.map(async (n) => ({
      id: n.id,
      name: n.name,
      barangay: await barangayNameById(n.barangayId),
      off: n.status === 'MAINTENANCE',
    })));
    data.sort((a, b) => a.barangay.localeCompare(b.barangay));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not load stations.' });
  }
});

// ── GET /api/v1/telemetry/projection ─────────────────────────────────────────
// Returns latest MLProjection row; triggers a fresh DB-backed inference if stale.
router.get('/projection', async (req, res) => {
  try {
    if (req.query.nodeId) {
      const fresh = await runPredictionInference(parseInt(req.query.nodeId), { save: false });
      return res.json({ success: true, data: fresh ? { ...fresh, ...getModelStatus() } : null });
    }
    let latest = null;
    try {
      latest = await prisma.mLProjection.findFirst({
        orderBy: { generatedAt: 'desc' },
      });
    } catch (_e) {
      latest = memoryLatestProjection;
    }

    if (!latest) {
      // No projection yet — run one on demand
      try {
        const fresh = await runPredictionInference();
        if (!fresh) return res.json({ success: true, data: null, message: 'No telemetry data available for projection.' });
        return res.json({ success: true, data: { ...fresh, ...getModelStatus() } });
      } catch (_e) {
        return res.json({ success: true, data: memoryLatestProjection });
      }
    }

    res.json({ success: true, data: { ...latest, ...getModelStatus() } });
  } catch (err) {
    console.error('[GET /telemetry/projection]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ── GET /api/v1/telemetry/latest ─────────────────────────────────────────────
// Query: nodeId (optional) — latest reading of one board
router.get('/latest', async (req, res) => {
  try {
    const nodeId = req.query.nodeId ? parseInt(req.query.nodeId) : null;
    const nodeWhere = nodeId ? { nodeId } : {};
    let latest = null;
    try {
      latest = await prisma.telemetryLog.findFirst({
        where: nodeWhere,
        orderBy: { recordedAt: 'desc' },
      });
    } catch (_e) {
      latest = memoryTelemetryLogs.find(l => !nodeId || l.nodeId === nodeId) || null;
    }

    if (!latest) return res.json({ success: true, data: null, message: 'No telemetry data recorded yet.' });

    // 15-minute surge rate
    const recordedTime = latest.recordedAt instanceof Date ? latest.recordedAt.getTime() : new Date(latest.recordedAt).getTime();
    const fifteenMinsAgo = new Date(recordedTime - 15 * 60 * 1000);
    
    let baseline = null;
    try {
      baseline = await prisma.telemetryLog.findFirst({
        where:   { ...nodeWhere, recordedAt: { lte: fifteenMinsAgo } },
        orderBy: { recordedAt: 'desc' },
      });
    } catch (_e) {
      baseline = memoryTelemetryLogs.find(l => (!nodeId || l.nodeId === nodeId) && new Date(l.recordedAt).getTime() <= fifteenMinsAgo.getTime()) || null;
    }

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
        thresholds: await getThresholds(latest.nodeId),
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
    const { range, from, to, limit = 100, nodeId } = req.query;
    const where = {};
    if (nodeId) where.nodeId = parseInt(nodeId);
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

    let logs = [];
    try {
      logs = await prisma.telemetryLog.findMany({
        where,
        orderBy: { recordedAt: 'asc' },
        take: Math.min(parseInt(limit), 1000),
      });
    } catch (_e) {
      logs = [...memoryTelemetryLogs].reverse().slice(0, Math.min(parseInt(limit), 1000));
    }

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
// Water level report: one row per 10 minutes with the highest level in that window.
// Query: from, to (ISO dates), nodeId (optional)
const csvCell = (v) => {
  const t = v == null ? '' : String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const phTime = (d) => new Date(d).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });

router.get('/export/csv', requirePermission('reports.view'), async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 7 * 864e5);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const nodeId = req.query.nodeId ? parseInt(req.query.nodeId) : null;

    const rows = await prisma.$queryRaw`
      SELECT to_timestamp(floor(extract(epoch FROM recorded_at) / 600) * 600) AS slot,
             node_id,
             MAX(water_level_m) AS level,
             MAX(flow_speed_ms) AS speed
      FROM telemetry_logs
      WHERE recorded_at BETWEEN ${from} AND ${to}
        AND (${nodeId}::int IS NULL OR node_id = ${nodeId}::int)
      GROUP BY slot, node_id
      ORDER BY slot ASC`;

    const nodes = await prisma.hardwareNode.findMany({ select: { id: true, name: true } });
    const nameOf = Object.fromEntries(nodes.map((n) => [n.id, n.name]));
    const thresholdsOf = {};
    const levelName = async (id, level) => {
      thresholdsOf[id] ??= await getThresholds(id);
      const t = thresholdsOf[id];
      if (level >= t.level3_danger) return 'Level 3 (Spill)';
      if (level >= t.level2_alarm) return 'Level 2 (Warning)';
      if (level >= t.level1_watch) return 'Level 1 (Advisory)';
      return 'Normal';
    };

    const lines = ['Date & time,Board,Highest water level (m),Water speed (m/s),Alert level'];
    for (const r of rows) {
      const level = Number(r.level);
      lines.push([
        phTime(r.slot),
        nameOf[r.node_id] || '',
        level.toFixed(2),
        r.speed != null ? Number(r.speed).toFixed(2) : '',
        await levelName(r.node_id, level),
      ].map(csvCell).join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="SmartFlood_water_levels.csv"');
    res.send(lines.join('\n'));
  } catch (err) {
    console.error('[GET /telemetry/export/csv]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ── GET /api/v1/telemetry/export/alerts-csv ──────────────────────────────────
// Alert report: the same alert history shown on the Alerts page (emails to residents).
// Query: from, to (ISO dates), nodeId (optional — staff-sent alerts have no board)
router.get('/export/alerts-csv', requirePermission('reports.view'), async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 7 * 864e5);
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const nodeId = req.query.nodeId ? parseInt(req.query.nodeId) : null;

    const alerts = await prisma.alertBroadcast.findMany({
      where: {
        triggeredAt: { gte: from, lte: to },
        ...(nodeId ? { OR: [{ nodeId }, { triggerLog: { nodeId } }] } : {}),
      },
      orderBy: { triggeredAt: 'asc' },
      include: {
        node: { select: { name: true } },
        triggerLog: { select: { node: { select: { name: true } } } },
        _count: { select: { dispatchLogs: true, smsLogs: true } },
      },
    });

    const LEVEL = { 1: 'Level 1 (Advisory)', 2: 'Level 2 (Warning)', 3: 'Level 3 (Spill)' };
    const lines = ['Date & time,Board,Level,Message,Emails sent,SMS sent'];
    for (const a of alerts) {
      lines.push([
        phTime(a.triggeredAt),
        a.node?.name || a.triggerLog?.node?.name || '',
        LEVEL[a.alertLevel] || `Level ${a.alertLevel}`,
        a.message,
        a._count.dispatchLogs,
        a._count.smsLogs,
      ].map(csvCell).join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="SmartFlood_alerts.csv"');
    res.send(lines.join('\n'));
  } catch (err) {
    console.error('[GET /telemetry/export/alerts-csv]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

export default router;
