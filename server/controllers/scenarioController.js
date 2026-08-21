import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../db.js';
import { recordPrediction, recordActualAndEvaluate, getEvaluationMetrics } from '../services/aiEvaluationService.js';
import { buildHistoryBuffer, getPrediction } from '../services/dlService.js';
import { broadcast } from '../websocket.js';
import { broadcastPushAlert } from '../services/webpushService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCENARIOS_FILE = path.join(__dirname, '..', 'data', 'scenarios.json');

// Load scenarios from JSON file
function loadScenarios() {
  try {
    const raw = fs.readFileSync(SCENARIOS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed.scenarios || [];
  } catch (err) {
    console.error('[ScenarioController] Failed to load scenarios.json:', err.message);
    return [];
  }
}

// Global active scenario state
let activeInterval = null;
let activeScenarioId = null;
let activeStepIndex = 0;
let activeTotalSteps = 0;

/**
 * GET /api/v1/test/scenarios
 * Returns list of pre-packaged test scenarios
 */
export function getScenariosList(req, res) {
  const scenarios = loadScenarios();
  const summary = scenarios.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    totalSteps: s.totalSteps,
  }));
  res.json({ success: true, count: summary.length, data: summary });
}

/**
 * GET /api/v1/test/scenario-status
 * Returns current running scenario playback status
 */
export function getScenarioStatus(req, res) {
  res.json({
    success: true,
    isRunning: !!activeInterval,
    scenarioId: activeScenarioId,
    currentStep: activeStepIndex,
    totalSteps: activeTotalSteps,
  });
}

/**
 * POST /api/v1/test/run-scenario
 * Runs selected pre-packaged scenario step-by-step at 2.5s intervals
 */
export async function runScenario(req, res) {
  try {
    const { scenarioId = 'flash_flood', stepIntervalMs = 2500 } = req.body;
    const scenarios = loadScenarios();
    const scenario = scenarios.find(s => s.id === scenarioId);

    if (!scenario) {
      return res.status(404).json({ success: false, error: `Scenario '${scenarioId}' not found.` });
    }

    // Stop any currently running scenario loop
    if (activeInterval) {
      clearInterval(activeInterval);
      activeInterval = null;
    }

    activeScenarioId = scenario.id;
    activeStepIndex = 0;
    activeTotalSteps = scenario.totalSteps;

    console.log(`[ScenarioController] Starting scenario '${scenario.name}' (${scenario.totalSteps} steps at ${stepIntervalMs}ms interval)...`);

    res.json({
      success: true,
      message: `Started scenario '${scenario.name}' (${scenario.totalSteps} steps).`,
      scenarioId: scenario.id,
      totalSteps: scenario.totalSteps,
    });

    const MOUNT_HEIGHT_CM = 180;
    let prevStage = scenario.steps[0]?.stage || 0.35;

    activeInterval = setInterval(async () => {
      if (activeStepIndex >= scenario.steps.length) {
        clearInterval(activeInterval);
        activeInterval = null;
        console.log(`[ScenarioController] Scenario '${scenario.name}' completed.`);
        broadcast({
          type: 'SCENARIO_COMPLETE',
          data: { scenarioId: scenario.id, totalSteps: scenario.totalSteps },
        });
        return;
      }

      const stepData = scenario.steps[activeStepIndex];
      activeStepIndex++;

      const water_level_m = parseFloat(stepData.stage.toFixed(3));
      const raw_distance_cm = Math.max(15, Math.round(MOUNT_HEIGHT_CM - water_level_m * 100));
      const rainfall_rate = parseFloat(stepData.rain.toFixed(2));
      const tip_count = Math.round(rainfall_rate * 0.5);

      // Save log in Prisma DB
      const log = await prisma.telemetryLog.create({
        data: {
          water_level_m,
          raw_distance_cm,
          rainfall_rate,
          tip_count,
          rssi_dbm: -65,
          supply_voltage: 12.2,
          uptime_sec: activeStepIndex * 600,
          sensor_status: raw_distance_cm <= 25 ? 'BLIND_SPOT' : 'OK',
        },
      });

      // Record actual reading for horizon queue evaluation
      recordActualAndEvaluate(log);

      // Determine alert level
      let eventCode = null;
      let severity = 'INFO';
      if (water_level_m >= 1.6) {
        eventCode = 'ALERT_L3';
        severity = 'CRITICAL';
      } else if (water_level_m >= 1.4) {
        eventCode = 'ALERT_L2';
        severity = 'WARNING';
      } else if (water_level_m >= 1.0) {
        eventCode = 'ALERT_L1';
        severity = 'NOTICE';
      }

      let event = null;
      if (eventCode) {
        event = await prisma.systemEvent.create({
          data: {
            event_code: eventCode,
            message: `[${scenario.name} Step ${activeStepIndex}/${scenario.totalSteps}] ${stepData.comment} — Stage: ${water_level_m}m`,
            severity,
          },
        });
      }

      // Run ONNX LSTM inference
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
      const projection = await getPrediction(historyBuffer);

      if (projection) {
        recordPrediction(projection);
      }

      const alertStatus = {
        level: water_level_m >= 1.6 ? 3 : water_level_m >= 1.4 ? 2 : water_level_m >= 1.0 ? 1 : 0,
        thresholds: { level1_watch: 1.0, level2_alarm: 1.4, level3_danger: 1.6 },
        eventCode,
      };

      // Broadcast scenario step status and telemetry over WebSocket
      broadcast({
        type: 'SCENARIO_PROGRESS',
        data: {
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          currentStep: activeStepIndex,
          totalSteps: scenario.totalSteps,
          comment: stepData.comment,
          isRunning: true,
        },
      });

      broadcast({ type: 'TELEMETRY', data: log });
      if (event) broadcast({ type: 'EVENT', data: event });
      if (projection) broadcast({ type: 'PROJECTION', data: projection });
      broadcast({ type: 'ALERT_STATUS', data: alertStatus });
      broadcast({ type: 'AI_EVALUATION', data: getEvaluationMetrics() });

      // Trigger Web Push alert on Level 2+
      if (alertStatus.level >= 2) {
        broadcastPushAlert({
          title: alertStatus.level === 3 ? '🚨 LEVEL 3 EMERGENCY ALERT' : '⚠️ LEVEL 2 WARNING ALARM',
          body: `WARNING: Water level reached ${water_level_m.toFixed(2)}m in Antipolo during test scenario.`,
          level: alertStatus.level,
          url: '/',
        }).catch(() => {});
      }

      prevStage = water_level_m;
    }, stepIntervalMs);

  } catch (err) {
    console.error('[POST /test/run-scenario]', err);
    res.status(500).json({ success: false, error: 'Failed to run scenario', detail: err.message });
  }
}

/**
 * POST /api/v1/test/stop-scenario
 * Stops any currently running scenario playback immediately
 */
export function stopScenario(req, res) {
  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }

  console.log('[ScenarioController] Scenario playback stopped by user.');

  broadcast({
    type: 'SCENARIO_STOPPED',
    data: { scenarioId: activeScenarioId, currentStep: activeStepIndex, isRunning: false },
  });

  res.json({
    success: true,
    message: 'Scenario playback halted.',
    stoppedAtStep: activeStepIndex,
  });
}
