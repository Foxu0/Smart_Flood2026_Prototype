#!/usr/bin/env node

/**
 * 🌊 SMART FLOOD 2026 — STANDALONE VIRTUAL ESP32 EDGE EMULATOR
 * ==============================================================================
 * A self-contained, disposable CLI client that emulates a physical ESP32 node.
 * Translates hydrological stage height and rain rate into raw ultrasonic distance
 * (cm) and tipping-bucket pulses, streaming POST /api/v1/telemetry directly to
 * localhost or the Render cloud backend.
 * ==============================================================================
 */

import readline from 'readline';

// Default Target Endpoints
let TARGET_URL = process.env.TELEMETRY_URL || 'http://localhost:5000/api/v1/telemetry';
const RENDER_PROD_URL = 'https://smart-flood2026-prototype.onrender.com/api/v1/telemetry';

// Auto-detect fallback port 3001 vs 5000 on startup
try {
  fetch('http://localhost:5000/api/v1/health').catch(() => {
    if (!process.env.TELEMETRY_URL) TARGET_URL = 'http://localhost:3001/api/v1/telemetry';
  });
} catch { /* silent */ }

// Physical Hardware Constants (matches SmartFlood_ESP32.ino)
const SENSOR_MOUNT_HEIGHT_CM = 180; // 1.80m above riverbed
const TIP_VOLUME_MM = 0.2;          // 0.2mm per tip

// System Uptime Tracker
let systemUptimeSec = 300;

// ANSI Terminal Colors
const C = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

// Create CLI Interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

/**
 * ESP32 Telemetry Packet Synthesizer
 * Converts water level (m) and rain rate (mm/h) into raw hardware readings.
 */
/**
 * ESP32 Telemetry Packet Synthesizer
 * Converts stage height (m) and rain rate (mm/h) into raw hardware readings
 * with Gaussian surface acoustic jitter and discrete tip pulse quantization.
 */
function synthesizeTelemetryPacket(waterLevelM, rainRateMmHr) {
  // Base raw distance in cm (mount height 180cm)
  const baseDistance = SENSOR_MOUNT_HEIGHT_CM - (waterLevelM * 100);

  // Gaussian surface acoustic chop jitter (±0.8 to 1.5 cm)
  const acousticJitter = (Math.random() - 0.5) * 2.2;
  let rawDistance = Math.round(baseDistance + acousticJitter);
  rawDistance = Math.max(20, Math.min(180, rawDistance));

  // Tipping-bucket pulse quantization: rainTips = Math.round((R * 0.1667) / 0.2)
  let rainTips = Math.round((rainRateMmHr * 0.1667) / TIP_VOLUME_MM);
  if (rainRateMmHr > 0) {
    const tipJitter = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1 tip
    rainTips = Math.max(0, rainTips + tipJitter);
  }

  // Relay & Battery voltage dynamics (drops 0.3V when siren is energized)
  const relayActive = waterLevelM >= 1.4;
  const baseVoltage = 12.4 + (Math.random() * 0.3 - 0.15); // 12.4V ± 0.15V
  const batteryVoltage = parseFloat((relayActive ? baseVoltage - 0.3 : baseVoltage).toFixed(2));
  const wifiRssi = -58 + Math.floor(Math.random() * 9 - 4); // -58 ± 4 dBm

  systemUptimeSec += 10;

  return {
    rawDistance,
    rainTips,
    batteryVoltage,
    wifiRssi,
    uptime: systemUptimeSec,
    relayState: relayActive,
  };
}

/**
 * Send POST /api/v1/telemetry packet to target server and parse response
 */
async function sendTelemetry(packet, stepStr = '01/01', comment = '', delaySec = 3.0) {
  try {
    const res = await fetch(TARGET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(packet),
    });

    const isOk = res.ok;
    const statusText = `${res.status} OK`;
    let data = {};
    try {
      data = await res.json();
    } catch { /* silent */ }

    // Parse Response Highlights
    const logObj = data.log || data.data || {};
    const stageM = parseFloat(logObj.water_level_m ?? (180 - packet.rawDistance) / 100).toFixed(2);
    const rawCm = logObj.raw_distance_cm ?? packet.rawDistance;
    const rainMm = parseFloat(logObj.rainfall_rate ?? (packet.rainTips * 1.2)).toFixed(1);

    const alertStatus = data.event?.event_code || data.eventTriggered?.event_type || data.alertStatus?.eventCode || (stageM >= 1.6 ? 'ALERT_L3' : stageM >= 1.4 ? 'ALERT_L2' : stageM >= 1.0 ? 'ALERT_L1' : 'NORMAL');
    const aiEval = data.aiEvaluation || {};
    const rawConf = aiEval.avgAccuracy_pct;
    const aiConf = typeof rawConf === 'number'
      ? `${rawConf.toFixed(1)}%`
      : (projObj.confidenceScore ? `${projObj.confidenceScore.toFixed(1)}%` : 'Evaluating...');
    const sirenText = (packet.relayState || data.sirenActive || stageM >= 1.4) ? `${C.red}${C.bold}ON 🚨${C.reset}` : `${C.dim}OFF${C.reset}`;

    let statusColor = C.green;
    if (alertStatus.includes('L1')) statusColor = C.yellow;
    if (alertStatus.includes('L2') || alertStatus.includes('L3')) statusColor = C.red;

    console.log(
      `[Step ${stepStr}] (${delaySec.toFixed(1)}s tick) POST -> ${isOk ? `${C.green}${statusText}${C.reset}` : `${C.red}${res.status} ${res.statusText}${C.reset}`} | ` +
      `Stage: ${C.bold}${stageM}m${C.reset} (Raw: ${rawCm}cm) | ` +
      `Rain: ${rainMm}mm/h | ` +
      `Status: ${statusColor}${alertStatus}${C.reset} | ` +
      `AI +30m: ${ai30m} (${aiConf}) | ` +
      `Siren: ${sirenText}` +
      (comment ? ` ${C.dim}— ${comment}${C.reset}` : '')
    );

    return { isOk, data };
  } catch (err) {
    console.log(`[Step ${stepStr}] ${C.red}POST FAILED${C.reset} -> ${err.message} (${TARGET_URL})`);
    return { isOk: false, error: err.message };
  }
}

/**
 * Delay Helper (ms)
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ── 48-STEP TYPHOON HYDROLOGICAL SCENARIO DATASET ─────────────────────────────
const TYPHOON_48_STEPS = [
  // --- Phase 1: Dry Baseline (Steps 1-8, 5.0s interval) ---
  { step: 1,  stage: 0.35, rain: 0.0,  delay: 5000, desc: "Dry Baseline (Calm)" },
  { step: 2,  stage: 0.35, rain: 0.0,  delay: 5000, desc: "Dry Baseline (Buffer Warmup)" },
  { step: 3,  stage: 0.35, rain: 0.0,  delay: 5000, desc: "Dry Baseline (Buffer Warmup)" },
  { step: 4,  stage: 0.35, rain: 0.0,  delay: 5000, desc: "Dry Baseline (Buffer Warmup)" },
  { step: 5,  stage: 0.35, rain: 0.0,  delay: 5000, desc: "Dry Baseline (Buffer Warmup)" },
  { step: 6,  stage: 0.35, rain: 0.0,  delay: 5000, desc: "Dry Baseline (Buffer Ready)" },
  { step: 7,  stage: 0.35, rain: 0.0,  delay: 5000, desc: "Dry Baseline (Stable Buffer)" },
  { step: 8,  stage: 0.36, rain: 5.0,  delay: 5000, desc: "Pre-storm Drizzle" },

  // --- Phase 2: Soil Saturation & Infiltration (Steps 9-16, 4.5s interval) ---
  { step: 9,  stage: 0.37, rain: 15.0, delay: 4500, desc: "Light Rain Onset" },
  { step: 10, stage: 0.39, rain: 22.0, delay: 4500, desc: "Soil Saturation Progressing" },
  { step: 11, stage: 0.42, rain: 28.0, delay: 4500, desc: "Moderate Rain" },
  { step: 12, stage: 0.46, rain: 35.0, delay: 4500, desc: "Steady Downpour" },
  { step: 13, stage: 0.50, rain: 40.0, delay: 4500, desc: "Watershed Infiltration Limit" },
  { step: 14, stage: 0.55, rain: 45.0, delay: 4500, desc: "Surface Runoff Beginning" },
  { step: 15, stage: 0.60, rain: 50.0, delay: 4500, desc: "Runoff Feeding Tributaries" },
  { step: 16, stage: 0.66, rain: 55.0, delay: 4500, desc: "Stream Velocity Rising" },

  // --- Phase 3: Storm Surge & Threshold Breaches (Steps 17-24, 4.0s interval) ---
  { step: 17, stage: 0.74, rain: 65.0, delay: 4000, desc: "Heavy Torrential Rain" },
  { step: 18, stage: 0.85, rain: 72.0, delay: 4000, desc: "Rapid Inflow Surge" },
  { step: 19, stage: 0.98, rain: 78.0, delay: 4000, desc: "Approaching Level 1" },
  { step: 20, stage: 1.08, rain: 82.0, delay: 4000, desc: "BREACH: ALERT LEVEL 1 (Advisory)" },
  { step: 21, stage: 1.18, rain: 85.0, delay: 4000, desc: "Intense Cloudburst" },
  { step: 22, stage: 1.28, rain: 80.0, delay: 4000, desc: "Surge Accelerating" },
  { step: 23, stage: 1.38, rain: 75.0, delay: 4000, desc: "Approaching Level 2 Alarm" },
  { step: 24, stage: 1.48, rain: 70.0, delay: 4000, desc: "BREACH: ALERT LEVEL 2 (Siren Active 🚨)" },

  // --- Phase 4: Peak Flash Flood Crest (Steps 25-28, 3.0s interval - Urgent) ---
  { step: 25, stage: 1.56, rain: 55.0, delay: 3000, desc: "Severe Flooding Surge" },
  { step: 26, stage: 1.62, rain: 40.0, delay: 3000, desc: "BREACH: ALERT LEVEL 3 (Peak Crest 🚨)" },
  { step: 27, stage: 1.60, rain: 25.0, delay: 3000, desc: "Hydrograph Peak Plateau" },
  { step: 28, stage: 1.55, rain: 15.0, delay: 3000, desc: "Rain Subsiding Rapidly" },

  // --- Phase 5: Catchment Retention Lag (Steps 29-38, 5.0s interval) ---
  { step: 29, stage: 1.48, rain: 8.0,  delay: 5000, desc: "Upstream Runoff Sustaining Stage" },
  { step: 30, stage: 1.42, rain: 4.0,  delay: 5000, desc: "Rain Ceasing, Channel Full" },
  { step: 31, stage: 1.35, rain: 0.0,  delay: 5000, desc: "Water Level Dropping Below L2" },
  { step: 32, stage: 1.28, rain: 0.0,  delay: 5000, desc: "Slow Soil Retention Drainage" },
  { step: 33, stage: 1.20, rain: 0.0,  delay: 5000, desc: "Watershed Outflow Drain" },
  { step: 34, stage: 1.12, rain: 0.0,  delay: 5000, desc: "Gradual Channel Drawdown" },
  { step: 35, stage: 1.05, rain: 0.0,  delay: 5000, desc: "Approaching Level 1 Return" },
  { step: 36, stage: 0.98, rain: 0.0,  delay: 5000, desc: "Water Level Below L1" },
  { step: 37, stage: 0.90, rain: 0.0,  delay: 5000, desc: "Persistent Drainage Tail" },
  { step: 38, stage: 0.82, rain: 0.0,  delay: 5000, desc: "Steady Baseflow Drainage" },

  // --- Phase 6: Drainage & Baseline Recovery (Steps 39-48, 6.0s interval) ---
  { step: 39, stage: 0.74, rain: 0.0,  delay: 6000, desc: "Recession Limb Continuing" },
  { step: 40, stage: 0.66, rain: 0.0,  delay: 6000, desc: "Low Flow Drainage" },
  { step: 41, stage: 0.58, rain: 0.0,  delay: 6000, desc: "Recession Limb" },
  { step: 42, stage: 0.52, rain: 0.0,  delay: 6000, desc: "Return to Near-Normal" },
  { step: 43, stage: 0.46, rain: 0.0,  delay: 6000, desc: "Stream Settling" },
  { step: 44, stage: 0.42, rain: 0.0,  delay: 6000, desc: "Channel Cleared" },
  { step: 45, stage: 0.38, rain: 0.0,  delay: 6000, desc: "Approaching Baseflow" },
  { step: 46, stage: 0.36, rain: 0.0,  delay: 6000, desc: "Residual Baseflow" },
  { step: 47, stage: 0.35, rain: 0.0,  delay: 6000, desc: "Dry Channel Restored" },
  { step: 48, stage: 0.35, rain: 0.0,  delay: 6000, desc: "Normal Baseline Complete" }
];

const SCENARIO_MODERATE_RAIN = [
  // Phase 1: Buffer Warmup (Steps 1-6)
  { step: 1,  stage: 0.35, rain: 0.0,  delay: 5000, desc: "Normal Baseflow (Buffer Warmup)" },
  { step: 2,  stage: 0.35, rain: 0.0,  delay: 5000, desc: "Normal Baseflow (Buffer Warmup)" },
  { step: 3,  stage: 0.35, rain: 0.0,  delay: 5000, desc: "Normal Baseflow (Buffer Warmup)" },
  { step: 4,  stage: 0.35, rain: 0.0,  delay: 5000, desc: "Normal Baseflow (Buffer Warmup)" },
  { step: 5,  stage: 0.35, rain: 0.0,  delay: 5000, desc: "Normal Baseflow (Buffer Ready)" },
  { step: 6,  stage: 0.36, rain: 5.0,  delay: 5000, desc: "Pre-storm Drizzle Onset" },

  // Phase 2: Steady Rain Onset (Steps 7-12)
  { step: 7,  stage: 0.38, rain: 15.0, delay: 4500, desc: "Light Steady Rain" },
  { step: 8,  stage: 0.45, rain: 25.0, delay: 4500, desc: "Moderate Rain Building" },
  { step: 9,  stage: 0.55, rain: 30.0, delay: 4500, desc: "Soil Saturation & Runoff" },
  { step: 10, stage: 0.68, rain: 35.0, delay: 4500, desc: "Stream Velocity Rising" },
  { step: 11, stage: 0.82, rain: 40.0, delay: 4500, desc: "Continuous Torrential Rain" },
  { step: 12, stage: 0.95, rain: 42.0, delay: 4500, desc: "Approaching Level 1 Watch" },

  // Phase 3: Level 1 Advisory Peak (Steps 13-16)
  { step: 13, stage: 1.05, rain: 45.0, delay: 4000, desc: "BREACH: ALERT LEVEL 1 (Advisory)" },
  { step: 14, stage: 1.15, rain: 45.0, delay: 4000, desc: "Peak Moderate Hydrograph (1.15m)" },
  { step: 15, stage: 1.12, rain: 30.0, delay: 4000, desc: "Rain Slowing - Water Plateau" },
  { step: 16, stage: 1.08, rain: 20.0, delay: 4000, desc: "Upstream Inflow Sustaining Stage" },

  // Phase 4: Drainage & Recovery (Steps 17-24)
  { step: 17, stage: 0.98, rain: 10.0, delay: 5000, desc: "Receding Below Level 1 Threshold" },
  { step: 18, stage: 0.88, rain: 5.0,  delay: 5000, desc: "Drizzle Ceasing, Channel Outflow" },
  { step: 19, stage: 0.75, rain: 0.0,  delay: 5000, desc: "Steady Baseflow Drawdown" },
  { step: 20, stage: 0.62, rain: 0.0,  delay: 5000, desc: "Recession Limb Progressing" },
  { step: 21, stage: 0.50, rain: 0.0,  delay: 5000, desc: "Stream Channel Settling" },
  { step: 22, stage: 0.42, rain: 0.0,  delay: 5000, desc: "Approaching Normal Baseflow" },
  { step: 23, stage: 0.36, rain: 0.0,  delay: 5000, desc: "Residual Channel Flow" },
  { step: 24, stage: 0.35, rain: 0.0,  delay: 5000, desc: "Normal Baseflow Restored (0.35m)" },
];

const SCENARIO_CALM_BASELINE = [
  { step: 1,  stage: 0.35, rain: 0.0, delay: 4000, desc: "Calm Baseflow (Normal 0.35m)" },
  { step: 2,  stage: 0.35, rain: 0.0, delay: 4000, desc: "Calm Baseflow (Ultrasonic Ripple)" },
  { step: 3,  stage: 0.36, rain: 0.0, delay: 4000, desc: "Calm Baseflow (Ultrasonic Ripple)" },
  { step: 4,  stage: 0.35, rain: 0.0, delay: 4000, desc: "Calm Baseflow (Ultrasonic Ripple)" },
  { step: 5,  stage: 0.35, rain: 0.0, delay: 4000, desc: "Calm Baseflow (Buffer Stable)" },
  { step: 6,  stage: 0.34, rain: 0.0, delay: 4000, desc: "Calm Baseflow (Ultrasonic Ripple)" },
  { step: 7,  stage: 0.35, rain: 0.0, delay: 4000, desc: "Calm Baseflow (Ultrasonic Ripple)" },
  { step: 8,  stage: 0.35, rain: 0.0, delay: 4000, desc: "Calm Baseflow (Ultrasonic Ripple)" },
  { step: 9,  stage: 0.36, rain: 0.0, delay: 4000, desc: "Calm Baseflow (Ultrasonic Ripple)" },
  { step: 10, stage: 0.35, rain: 0.0, delay: 4000, desc: "Calm Baseflow (Buffer Stable)" },
  { step: 11, stage: 0.35, rain: 0.0, delay: 4000, desc: "Calm Baseflow (Ultrasonic Ripple)" },
  { step: 12, stage: 0.35, rain: 0.0, delay: 4000, desc: "Calm Baseflow Baseline Complete" },
];

// ── MAIN CLI ROUTINE ──────────────────────────────────────────────────────────
async function main() {
  console.clear();
  console.log(`${C.cyan}${C.bold}`);
  console.log(`==================================================`);
  console.log(`   🌊 SMART FLOOD 2026 — VIRTUAL ESP32 EDGE NODE  `);
  console.log(`==================================================${C.reset}`);
  console.log(`Target URL: ${C.yellow}${TARGET_URL}${C.reset}\n`);

  console.log(`${C.bold}Select Mode:${C.reset}`);
  console.log(`[1] Scenario: Rapid Flash Flood Surge (Level 2 Crest -> Drain)`);
  console.log(`[2] Scenario: Moderate Continuous Rain (Level 1 Advisory)`);
  console.log(`[3] Scenario: Calm Dry Baseline with Ultrasonic Surface Ripples`);
  console.log(`[4] Continuous Real-Time Stream (Sends 1 packet every 5s indefinitely)`);
  console.log(`[5] Interactive Manual Mode (Enter custom water level & rain rate)`);
  console.log(`[6] Toggle Target Server URL (Localhost vs Render Production)`);
  console.log(`[Q] Quit`);
  console.log(`==================================================`);

  const choice = (await askQuestion(`Enter selection (1-6 / Q): `)).trim().toUpperCase();

  if (choice === 'Q') {
    console.log(`\nExiting Virtual ESP32 Node emulator. Goodbye!`);
    rl.close();
    process.exit(0);
  }

  if (choice === '6') {
    if (TARGET_URL.includes('localhost')) {
      TARGET_URL = RENDER_PROD_URL;
    } else {
      TARGET_URL = 'http://localhost:5000/api/v1/telemetry';
    }
    return main();
  }

  if (choice === '1' || choice === '2' || choice === '3') {
    const dataset = choice === '1' ? TYPHOON_48_STEPS : choice === '2' ? SCENARIO_MODERATE_RAIN : SCENARIO_CALM_BASELINE;
    const title = choice === '1' ? '48-Step Authentic Typhoon Hydrological Cycle' : choice === '2' ? 'Moderate Continuous Rain' : 'Calm Dry Baseline';

    console.log(`\n🚀 Starting Scenario: ${C.bold}${title}${C.reset} (${dataset.length} steps)\n`);

    for (let i = 0; i < dataset.length; i++) {
      const step = dataset[i];
      const stageVal = step.stage != null ? step.stage : step.level;
      const descVal = step.desc != null ? step.desc : step.comment;
      const delayMs = step.delay != null ? step.delay : 3000;

      const packet = synthesizeTelemetryPacket(stageVal, step.rain);
      const stepStr = `${String(i + 1).padStart(2, '0')}/${String(dataset.length).padStart(2, '0')}`;

      await sendTelemetry(packet, stepStr, descVal, delayMs / 1000);
      if (i < dataset.length - 1) await sleep(delayMs);
    }

    console.log(`\n✅ Scenario execution complete!\n`);
    const next = await askQuestion(`Press Enter to return to menu...`);
    return main();
  }

  if (choice === '4') {
    console.log(`\n🛰️  Starting Continuous Real-Time Stream (1 packet every 5s). Press Ctrl+C to stop.\n`);
    let stepCount = 1;
    let currentLevel = 0.00;
    let currentRain = 0;

    while (true) {
      // Small simulated organic fluctuation
      currentRain = Math.max(0, Math.min(120, currentRain + (Math.random() * 10 - 5)));
      if (currentRain > 20) {
        currentLevel = Math.min(1.80, currentLevel + 0.04);
      } else {
        currentLevel = Math.max(0.00, currentLevel - 0.02);
      }

      const packet = synthesizeTelemetryPacket(currentLevel, currentRain);
      const stepStr = String(stepCount).padStart(3, '0');

      await sendTelemetry(packet, stepStr, 'Live Real-Time Stream');
      stepCount++;
      await sleep(5000);
    }
  }

  if (choice === '5') {
    console.log(`\n✍️  Interactive Manual Mode\n`);
    const lvlStr = await askQuestion(`Enter Water Level in meters (e.g. 1.25): `);
    const rainStr = await askQuestion(`Enter Rain Rate in mm/h (e.g. 45.0): `);

    const waterLevelM = parseFloat(lvlStr) || 0.00;
    const rainRateMmHr = parseFloat(rainStr) || 0.0;

    const packet = synthesizeTelemetryPacket(waterLevelM, rainRateMmHr);
    console.log(`\nSending Manual Telemetry Packet:`, packet);
    await sendTelemetry(packet, 'MANUAL', 'User Input');

    console.log(`\n✅ Packet transmitted!\n`);
    await askQuestion(`Press Enter to return to menu...`);
    return main();
  }

  console.log(`\nInvalid choice. Please select 1-6.`);
  await sleep(1500);
  return main();
}

main();
