import { prisma } from '../db.js';
import { getEvaluationMetrics, resetEvaluation, recordPrediction, recordActualAndEvaluate } from '../services/aiEvaluationService.js';
import { buildHistoryBuffer, getPrediction } from '../services/dlService.js';
import { broadcast } from '../websocket.js';
import { broadcastPushAlert } from '../services/webpushService.js';

// ── 20-Timestep Hydrological Storm Simulation Dataset ────────────────────────
// Represents a 200-minute realistic storm cycle in Antipolo City:
//   Phase 1 (0-30m): Baseline Dry State (0.30m stage, 0mm/h rain)
//   Phase 2 (30-70m): Heavy Rainfall Onset (45-75mm/h rain, 0.30m -> 0.65m stage)
//   Phase 3 (70-130m): Flash Flood Surge / Peak (Torrential rain, 0.65m -> 1.65m stage)
//   Phase 4 (130-170m): Rain Recession & Crest (Rain drops to 5mm/h, stage 1.65m -> 1.10m)
//   Phase 5 (170-200m): Drainage / Recovery (Stage recedes 1.10m -> 0.45m)
const SIMULATION_TIMESTEPS = [
  // Phase 1: Baseline Dry State
  { min: 0,   rawDistance: 150.0, rainTips: 0,  voltage: 12.4, rssi: -65, uptime: 300,  relay: false, comment: 'Baseline Dry State' },
  { min: 10,  rawDistance: 150.0, rainTips: 0,  voltage: 12.4, rssi: -65, uptime: 900,  relay: false, comment: 'Baseline Dry State' },
  { min: 20,  rawDistance: 149.5, rainTips: 0,  voltage: 12.4, rssi: -66, uptime: 1500, relay: false, comment: 'Baseline Dry State' },
  { min: 30,  rawDistance: 148.0, rainTips: 1,  voltage: 12.3, rssi: -65, uptime: 2100, relay: false, comment: 'Baseline Dry State' },

  // Phase 2: Heavy Rainfall Onset
  { min: 40,  rawDistance: 142.0, rainTips: 12, voltage: 12.3, rssi: -67, uptime: 2700, relay: false, comment: 'Heavy Rain Onset' },
  { min: 50,  rawDistance: 135.0, rainTips: 18, voltage: 12.2, rssi: -68, uptime: 3300, relay: false, comment: 'Heavy Rain Onset' },
  { min: 60,  rawDistance: 125.0, rainTips: 22, voltage: 12.2, rssi: -68, uptime: 3900, relay: false, comment: 'Heavy Rain Onset' },
  { min: 70,  rawDistance: 115.0, rainTips: 25, voltage: 12.1, rssi: -70, uptime: 4500, relay: false, comment: 'Heavy Rain Onset' },

  // Phase 3: Flash Flood Surge / Peak
  { min: 80,  rawDistance: 95.0,  rainTips: 32, voltage: 12.1, rssi: -72, uptime: 5100, relay: false, comment: 'Level 1 Advisory Watch' },
  { min: 90,  rawDistance: 75.0,  rainTips: 35, voltage: 12.0, rssi: -73, uptime: 5700, relay: false, comment: 'Level 1 Advisory Watch' },
  { min: 100, rawDistance: 55.0,  rainTips: 40, voltage: 12.0, rssi: -75, uptime: 6300, relay: true,  comment: 'Level 2 Siren Warning Alarm' },
  { min: 110, rawDistance: 35.0,  rainTips: 38, voltage: 11.9, rssi: -76, uptime: 6900, relay: true,  comment: 'Level 2 Siren Warning Alarm' },
  { min: 120, rawDistance: 15.0,  rainTips: 30, voltage: 11.9, rssi: -78, uptime: 7500, relay: true,  comment: 'Level 3 Emergency Danger' },

  // Phase 4: Rain Recession & Crest
  { min: 130, rawDistance: 20.0,  rainTips: 15, voltage: 11.9, rssi: -75, uptime: 8100, relay: true,  comment: 'Level 3 Emergency Danger' },
  { min: 140, rawDistance: 35.0,  rainTips: 6,  voltage: 12.0, rssi: -72, uptime: 8700, relay: true,  comment: 'Level 2 Warning' },
  { min: 150, rawDistance: 55.0,  rainTips: 3,  voltage: 12.1, rssi: -70, uptime: 9300, relay: false, comment: 'Level 2 Warning' },
  { min: 160, rawDistance: 70.0,  rainTips: 1,  voltage: 12.2, rssi: -68, uptime: 9900, relay: false, comment: 'Receding to Level 1' },

  // Phase 5: Drainage / Recovery
  { min: 170, rawDistance: 95.0,  rainTips: 0,  voltage: 12.3, rssi: -66, uptime: 10500, relay: false, comment: 'Drainage / Recovery' },
  { min: 180, rawDistance: 120.0, rainTips: 0,  voltage: 12.4, rssi: -65, uptime: 11100, relay: false, comment: 'Drainage / Recovery' },
  { min: 190, rawDistance: 135.0, rainTips: 0,  voltage: 12.4, rssi: -65, uptime: 11700, relay: false, comment: 'Drainage / Recovery' },
  { min: 200, rawDistance: 145.0, rainTips: 0,  voltage: 12.4, rssi: -65, uptime: 12300, relay: false, comment: 'Drainage / Recovery' },
];

/**
 * POST /api/v1/test/reset
 * Clears legacy test records from PostgreSQL tables to establish a clean baseline.
 */
export async function resetTestData(req, res) {
  try {
    console.log('[TestController] Resetting test telemetry and event logs...');

    const [deletedTelemetry, deletedEvents, deletedProjections] = await Promise.all([
      prisma.telemetryLog.deleteMany({}),
      prisma.systemEvent.deleteMany({}),
      prisma.mLProjection.deleteMany({}),
    ]);

    resetEvaluation();

    const result = {
      success: true,
      message: 'Test environment reset complete. Database tables truncated.',
      deletedRecords: {
        telemetry: deletedTelemetry.count,
        events: deletedEvents.count,
        projections: deletedProjections.count,
      },
    };

    // Broadcast reset event over WebSocket
    broadcast({ type: 'TEST_RESET', data: result });

    res.json(result);
  } catch (err) {
    console.error('[POST /test/reset]', err);
    res.status(500).json({ error: 'Failed to reset test data', detail: err.message });
  }
}

/**
 * GET /api/v1/test/ai-evaluation
 * Returns overall model metrics (MAE, RMSE, Accuracy %) and time-series comparison rows.
 */
export async function getAiEvaluation(req, res) {
  try {
    const metrics = getEvaluationMetrics();
    res.json({ success: true, data: metrics });
  } catch (err) {
    console.error('[GET /test/ai-evaluation]', err);
    res.status(500).json({ error: 'Failed to retrieve AI evaluation metrics', detail: err.message });
  }
}

/**
 * POST /api/v1/test/simulate
 * Triggers a backend-driven execution of the 20-step synthetic storm cycle.
 */
export async function runSimulationStream(req, res) {
  try {
    const MOUNT_HEIGHT_CM = 180;
    const TIP_VOLUME_MM   = 0.2;
    const intervalSecs    = 10; // simulated 10-min timesteps compressed to 1.5s per step

    console.log('[TestController] Starting 20-step synthetic storm simulation stream...');

    // Respond immediately to caller
    res.json({
      success: true,
      message: 'Hydrological storm simulation initiated (20 timesteps streaming over 30s).',
      totalSteps: SIMULATION_TIMESTEPS.length,
    });

    // Asynchronously stream the timesteps
    let stepCount = 0;
    const interval = setInterval(async () => {
      if (stepCount >= SIMULATION_TIMESTEPS.length) {
        clearInterval(interval);
        console.log('[TestController] Simulation stream completed.');
        broadcast({ type: 'SIMULATION_COMPLETE', data: { totalSteps: stepCount } });
        return;
      }

      const step = SIMULATION_TIMESTEPS[stepCount];
      stepCount++;

      const water_level_m   = Math.max(0, parseFloat(((MOUNT_HEIGHT_CM - step.rawDistance) / 100).toFixed(3)));
      const raw_distance_cm = step.rawDistance;
      const rainfall_rate   = parseFloat(((step.rainTips * TIP_VOLUME_MM) * (3600 / intervalSecs)).toFixed(2));

      // Save log
      const log = await prisma.telemetryLog.create({
        data: {
          water_level_m,
          raw_distance_cm,
          rainfall_rate,
          tip_count:      step.rainTips,
          rssi_dbm:       step.rssi,
          supply_voltage: step.voltage,
          uptime_sec:     step.uptime,
          sensor_status:  raw_distance_cm <= 25 ? 'BLIND_SPOT' : 'OK',
        },
      });

      // Evaluate actual reading in AI evaluation engine
      recordActualAndEvaluate(log);

      // Determine alert level
      let eventCode = null;
      let severity  = 'INFO';
      if (water_level_m >= 1.6) {
        eventCode = 'ALERT_L3';
        severity  = 'CRITICAL';
      } else if (water_level_m >= 1.4) {
        eventCode = 'ALERT_L2';
        severity  = 'WARNING';
      } else if (water_level_m >= 1.0) {
        eventCode = 'ALERT_L1';
        severity  = 'NOTICE';
      }

      let event = null;
      if (eventCode) {
        event = await prisma.systemEvent.create({
          data: { event_code: eventCode, message: `[Simulated Storm Step ${stepCount}/20] ${step.comment} — Stage: ${water_level_m}m`, severity },
        });
      }

      // Run ONNX inference
      const recentLogs = await prisma.telemetryLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 5,
        select: { water_level_m: true, rainfall_rate: true },
      });

      const chronological = [
        ...([...recentLogs].reverse()),
        { water_level_m, rainfall_rate },
      ];

      const historyBuffer = buildHistoryBuffer(chronological);
      const projection    = await getPrediction(historyBuffer);

      if (projection) {
        recordPrediction(projection);
      }

      const alertStatus = {
        level: water_level_m >= 1.6 ? 3 : water_level_m >= 1.4 ? 2 : water_level_m >= 1.0 ? 1 : 0,
        thresholds: { level1_watch: 1.0, level2_alarm: 1.4, level3_danger: 1.6 },
        eventCode,
      };

      // Broadcast telemetry, event, projection, and evaluation update over WebSocket
      broadcast({ type: 'TELEMETRY',    data: log });
      if (event)      broadcast({ type: 'EVENT',        data: event });
      if (projection) broadcast({ type: 'PROJECTION',   data: projection });
      broadcast({     type: 'ALERT_STATUS', data: alertStatus });
      broadcast({     type: 'AI_EVALUATION', data: getEvaluationMetrics() });

      console.log(`[Simulation Step ${stepCount}/20] Stage: ${water_level_m}m | Rain: ${rainfall_rate}mm/h | Mode: ${projection?.methodUsed || 'ONNX_LSTM'}`);
    }, 1500); // 1.5 seconds per step
  } catch (err) {
    console.error('[POST /test/simulate]', err);
  }
}
