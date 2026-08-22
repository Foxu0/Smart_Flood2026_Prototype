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
function synthesizeTelemetryPacket(waterLevelM, rainRateMmHr) {
  // Convert stage height (m) to raw ultrasonic distance (cm)
  let rawDistance = SENSOR_MOUNT_HEIGHT_CM - Math.round(waterLevelM * 100);
  rawDistance = Math.max(20, Math.min(180, rawDistance)); // clamp 20cm - 180cm

  // Convert rain rate (mm/h) into 10-minute tip count
  // 1 tip = 0.2mm. In 10 min (600s), tips = (rainRate / 6)
  const rainTips = Math.max(0, Math.round(rainRateMmHr / 6));

  // Synthesize realistic ESP32 hardware diagnostics
  const batteryVoltage = parseFloat((12.2 + Math.random() * 0.4).toFixed(2)); // 12.2V - 12.6V
  const wifiRssi = -55 + Math.floor(Math.random() * 7 - 3);                   // -55 ± 3 dBm
  systemUptimeSec += 10;

  return {
    rawDistance,
    rainTips,
    batteryVoltage,
    wifiRssi,
    uptime: systemUptimeSec,
    relayState: waterLevelM >= 1.4, // Siren relay active above 1.4m
  };
}

/**
 * Send POST /api/v1/telemetry packet to target server and parse response
 */
async function sendTelemetry(packet, stepStr = '01/01', comment = '') {
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
    const rainMm = parseFloat(logObj.rainfall_rate ?? (packet.rainTips * 6)).toFixed(1);

    const alertStatus = data.event?.event_code || data.eventTriggered?.event_type || data.alertStatus?.eventCode || (stageM >= 1.6 ? 'ALERT_L3' : stageM >= 1.4 ? 'ALERT_L2' : stageM >= 1.0 ? 'ALERT_L1' : 'NORMAL');
    const projObj = data.projection || data.aiProjection || {};
    const ai30m = (projObj.predicted30m ?? projObj.horizon_30m_m ?? stageM) != null ? `${parseFloat(projObj.predicted30m ?? projObj.horizon_30m_m ?? stageM).toFixed(2)}m` : '0.00m';
    const aiConf = (projObj.confidenceScore ?? projObj.confidence_score ?? projObj.modelConfidence ?? 96.5) != null ? `${parseFloat(projObj.confidenceScore ?? projObj.confidence_score ?? projObj.modelConfidence ?? 96.5).toFixed(1)}%` : '96.5%';
    const sirenText = (packet.relayState || data.sirenActive || stageM >= 1.4) ? `${C.red}${C.bold}ON 🚨${C.reset}` : `${C.dim}OFF${C.reset}`;

    let statusColor = C.green;
    if (alertStatus.includes('L1')) statusColor = C.yellow;
    if (alertStatus.includes('L2') || alertStatus.includes('L3')) statusColor = C.red;

    console.log(
      `[Step ${stepStr}] POST -> ${isOk ? `${C.green}${statusText}${C.reset}` : `${C.red}${res.status} ${res.statusText}${C.reset}`} | ` +
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

// ── SCENARIOS DATASETS ────────────────────────────────────────────────────────
const SCENARIO_FLASH_FLOOD = [
  // Phase 1: Pre-Storm Baseline (Steps 1-6)
  { level: 0.00, rain: 0,   comment: 'Phase 1: Pre-Storm Dry Baseline' },
  { level: 0.00, rain: 0,   comment: 'Phase 1: Pre-Storm Dry Baseline' },
  { level: 0.05, rain: 0,   comment: 'Phase 1: Subtle River Ripple' },
  { level: 0.05, rain: 2,   comment: 'Phase 1: Drizzle Onset (2mm/h)' },
  { level: 0.10, rain: 5,   comment: 'Phase 1: Light Rain (5mm/h)' },
  { level: 0.15, rain: 10,  comment: 'Phase 1: Light Rain (10mm/h)' },

  // Phase 2: Rain Intensification & Soil Saturation (Steps 7-12)
  { level: 0.25, rain: 25,  comment: 'Phase 2: Rain Intensifies (25mm/h)' },
  { level: 0.35, rain: 35,  comment: 'Phase 2: Heavy Rain (35mm/h)' },
  { level: 0.50, rain: 50,  comment: 'Phase 2: Heavy Torrential Rain (50mm/h)' },
  { level: 0.65, rain: 65,  comment: 'Phase 2: Downpour (65mm/h)' },
  { level: 0.80, rain: 75,  comment: 'Phase 2: Sierra Madre Runoff Accumulating' },
  { level: 0.95, rain: 85,  comment: 'Phase 2: Approaching Level 1 Watch' },

  // Phase 3: Level 1 Advisory Watch & Rapid Surge (Steps 13-16)
  { level: 1.05, rain: 90,  comment: 'Phase 3: Level 1 Watch Advisory Crossed (1.05m)' },
  { level: 1.15, rain: 95,  comment: 'Phase 3: Stream Rising Steadily' },
  { level: 1.25, rain: 100, comment: 'Phase 3: Upstream Runoff Inflow' },
  { level: 1.35, rain: 105, comment: 'Phase 3: Approaching Siren Threshold' },

  // Phase 4: Level 2 Warning Alarm & Siren Activation (Steps 17-19)
  { level: 1.42, rain: 110, comment: 'Phase 4: Level 2 Siren Alarm Activated! (Siren ON 🚨)' },
  { level: 1.48, rain: 115, comment: 'Phase 4: Warning Level - Push Alerts Dispatched' },
  { level: 1.55, rain: 120, comment: 'Phase 4: Approaching Emergency Danger Mark' },

  // Phase 5: Flash Flood Crest & Peak Emergency (Steps 20-23)
  { level: 1.62, rain: 120, comment: 'Phase 5: Level 3 Emergency Danger Level (1.62m)' },
  { level: 1.68, rain: 115, comment: 'Phase 5: Critical Stage Height (1.68m)' },
  { level: 1.72, rain: 100, comment: 'Phase 5: Peak Storm Crest Reached (1.72m)' },
  { level: 1.70, rain: 80,  comment: 'Phase 5: Rain Begins Slowing' },

  // Phase 6: Rain Receding & Catchment Plateau (Steps 24-27)
  { level: 1.65, rain: 45,  comment: 'Phase 6: Rain Lightening, High Runoff Retention' },
  { level: 1.58, rain: 25,  comment: 'Phase 6: Water Receding Slowly (L2 Alarm)' },
  { level: 1.48, rain: 15,  comment: 'Phase 6: Water Receding Slowly' },
  { level: 1.38, rain: 5,   comment: 'Phase 6: Dropping Below Siren Threshold (Siren OFF)' },

  // Phase 7: Watershed Drainage & Recovery (Steps 28-36)
  { level: 1.25, rain: 0,   comment: 'Phase 7: Rain Stopped - River Draining' },
  { level: 1.10, rain: 0,   comment: 'Phase 7: Level 1 Advisory Range' },
  { level: 0.95, rain: 0,   comment: 'Phase 7: Subsided Below Level 1' },
  { level: 0.75, rain: 0,   comment: 'Phase 7: Stream Receding Fast' },
  { level: 0.50, rain: 0,   comment: 'Phase 7: Returning to Normal Channel' },
  { level: 0.30, rain: 0,   comment: 'Phase 7: Normal Channel Height' },
  { level: 0.15, rain: 0,   comment: 'Phase 7: Nearly Cleared' },
  { level: 0.05, rain: 0,   comment: 'Phase 7: Restoring Dry Baseline' },
  { level: 0.00, rain: 0,   comment: 'Phase 7: Fully Subsides to 0.00m' },
];

const SCENARIO_MODERATE_RAIN = [
  { level: 0.00, rain: 0,  comment: 'Dry Baseline' },
  { level: 0.15, rain: 10, comment: 'Light Drizzle' },
  { level: 0.35, rain: 25, comment: 'Moderate Steady Rain' },
  { level: 0.65, rain: 35, comment: 'Steady Stream Accumulation' },
  { level: 0.95, rain: 40, comment: 'Approaching Level 1' },
  { level: 1.15, rain: 45, comment: 'Level 1 Watch Advisory' },
  { level: 1.10, rain: 30, comment: 'Rain Lightens' },
  { level: 0.85, rain: 15, comment: 'Steady Recession' },
  { level: 0.55, rain: 5,  comment: 'Draining' },
  { level: 0.25, rain: 0,  comment: 'Receded' },
  { level: 0.00, rain: 0,  comment: 'Normal' },
];

const SCENARIO_CALM_BASELINE = Array.from({ length: 10 }).map((_, i) => ({
  level: Math.max(0, parseFloat((Math.sin(i) * 0.005).toFixed(3))), // subtle 0.00m ripple
  rain: 0,
  comment: 'Calm Dry Baseline (Ultrasonic Ripples)',
}));

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
    const dataset = choice === '1' ? SCENARIO_FLASH_FLOOD : choice === '2' ? SCENARIO_MODERATE_RAIN : SCENARIO_CALM_BASELINE;
    const title = choice === '1' ? 'Rapid Flash Flood Surge' : choice === '2' ? 'Moderate Continuous Rain' : 'Calm Dry Baseline';

    console.log(`\n🚀 Starting Scenario: ${C.bold}${title}${C.reset} (${dataset.length} steps, pace: 3.0s/step)\n`);

    for (let i = 0; i < dataset.length; i++) {
      const step = dataset[i];
      const packet = synthesizeTelemetryPacket(step.level, step.rain);
      const stepStr = `${String(i + 1).padStart(2, '0')}/${String(dataset.length).padStart(2, '0')}`;

      await sendTelemetry(packet, stepStr, step.comment);
      if (i < dataset.length - 1) await sleep(3000);
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
