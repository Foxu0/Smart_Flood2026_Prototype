/**
 * Smart Flood Early Warning System — 2026 Prototype
 * Interactive / Automated Admin View Showcase Runner
 *
 * Usage:
 *   node tools/admin-showcase.js           (Interactive step-by-step mode)
 *   node tools/admin-showcase.js --auto    (Automated timed showcase playback)
 */

import readline from 'readline';

const API_BASE = process.env.API_BASE_URL || 'https://smart-flood2026-prototype.onrender.com';

// ANSI Colors
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgRed: '\x1b[41m',
};

const isAuto = process.argv.includes('--auto');

// Showcase Steps
const SHOWCASE_STEPS = [
  {
    step: 1,
    title: 'Baseline Normal River Conditions (All Clear)',
    stageM: 0.25,
    distanceCm: 215,
    rainRate: 0.0,
    tips: 0,
    voltage: 12.6,
    relay: 'OFF',
    level: 0,
    narrative: 'Monitoring station at Lower Antipolo riverbed is calm. Telemetry reports dry baseline stage well below advisory limits.',
  },
  {
    step: 2,
    title: 'Heavy Upstream Rains — Alert Level 1 (Advisory)',
    stageM: 1.28,
    distanceCm: 112,
    rainRate: 18.5,
    tips: 37,
    voltage: 12.4,
    relay: 'OFF',
    level: 1,
    narrative: 'Upstream precipitation intensifies. River depth crosses 1.20m (Watch Threshold). Dashboard triggers Level 1 Advisory and email notifications.',
  },
  {
    step: 3,
    title: 'Siren Threshold Breach — Alert Level 2 (Warning)',
    stageM: 1.72,
    distanceCm: 68,
    rainRate: 42.0,
    tips: 84,
    voltage: 12.1,
    relay: 'ON',
    level: 2,
    narrative: 'Water stage reaches 1.72m, crossing the 1.60m siren alarm threshold! The 12V optocoupler relay trips, sounding the high-dB acoustic siren.',
  },
  {
    step: 4,
    title: 'Critical Flood Crest — Alert Level 3 (Emergency Danger)',
    stageM: 2.15,
    distanceCm: 25,
    rainRate: 68.0,
    tips: 136,
    voltage: 11.9,
    relay: 'ON',
    level: 3,
    narrative: 'Danger crest at 2.15m breaches 2.00m critical mark. Sensor approaches 25cm blind spot. Mandatory evacuation sirens and critical broadcasts active.',
  },
  {
    step: 5,
    title: 'EOC Operator Manual Override (Siren Muted)',
    stageM: 2.08,
    distanceCm: 32,
    rainRate: 25.0,
    tips: 148,
    voltage: 12.3,
    relay: 'OFF',
    level: 3,
    narrative: 'EOC Operator acknowledges evacuation and activates Manual Override (Mute). Acoustic siren is silenced to prevent community panic while monitoring stays live.',
  },
  {
    step: 6,
    title: 'Receding Flood & System Normalization',
    stageM: 0.65,
    distanceCm: 175,
    rainRate: 1.2,
    tips: 152,
    voltage: 12.5,
    relay: 'OFF',
    level: 0,
    narrative: 'Rain subsides and floodwaters drain safely downstream. River stage falls back below 1.20m. System returns to All Clear monitoring state.',
  },
];

async function sendTelemetry(stepData) {
  try {
    const payload = {
      rawDistance: stepData.distanceCm,
      rainTips: stepData.tips,
      batteryVoltage: stepData.voltage,
      wifiRssi: -62,
      uptime: '02:45:10',
      relayState: stepData.relay,
      // Fallback direct stage fields
      water_level_m: stepData.stageM,
      raw_distance_cm: stepData.distanceCm,
      rainfall_rate: stepData.rainRate,
      tip_count: stepData.tips,
      supply_voltage: stepData.voltage,
      rssi_dbm: -62,
      uptime_sec: 9910,
      sensor_status: stepData.distanceCm <= 25 ? 'BLIND_SPOT' : 'NORMAL',
    };

    const res = await fetch(`${API_BASE}/api/v1/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function printHeader() {
  console.clear();
  console.log(`${C.cyan}${C.bold}╔═══════════════════════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.cyan}${C.bold}║              SMART FLOOD EOC ADMIN DASHBOARD — SHOWCASE RUNNER                ║${C.reset}`);
  console.log(`${C.cyan}${C.bold}║          Automated & Guided Demonstration of EOC Administrative Suite         ║${C.reset}`);
  console.log(`${C.cyan}${C.bold}╚═══════════════════════════════════════════════════════════════════════════════╝${C.reset}`);
  console.log(`${C.dim}Target Backend: ${API_BASE}${C.reset}`);
  console.log(`${C.dim}Mode: ${isAuto ? 'Automated Playback (6s per step)' : 'Interactive Guided Step-by-Step'}${C.reset}\n`);
}

function printStep(stepData, apiResult) {
  const levelColors = [C.green, C.blue, C.yellow, C.red];
  const levelNames = ['Level 0 (Normal)', 'Level 1 (Advisory)', 'Level 2 (Warning)', 'Level 3 (Danger)'];
  const lvlColor = levelColors[stepData.level] || C.white;

  console.log(`\n${C.bold}================================================================================${C.reset}`);
  console.log(`${C.cyan}${C.bold}[STEP ${stepData.step} / ${SHOWCASE_STEPS.length}] ${stepData.title}${C.reset}`);
  console.log(`${C.bold}================================================================================${C.reset}`);
  console.log(`  ${C.white}${C.bold}Alert Level:${C.reset}    ${lvlColor}${C.bold}${levelNames[stepData.level]}${C.reset}`);
  console.log(`  ${C.white}${C.bold}Water Stage:${C.reset}    ${C.cyan}${stepData.stageM.toFixed(2)} m${C.reset} (Distance: ${stepData.distanceCm} cm from 240cm sensor mount)`);
  console.log(`  ${C.white}${C.bold}Rainfall:${C.reset}       ${stepData.rainRate} mm/h (${stepData.tips} tips)`);
  console.log(`  ${C.white}${C.bold}12V Siren:${C.reset}      ${stepData.relay === 'ON' ? `${C.red}${C.bold}ACTIVE (RELAY ENERGIZED) 🚨${C.reset}` : `${C.dim}OFF (STANDBY)${C.reset}`}`);
  console.log(`  ${C.white}${C.bold}Telemetry Sync:${C.reset} ${apiResult?.success ? `${C.green}Ingested successfully${C.reset}` : `${C.yellow}Simulated (Local)${C.reset}`}`);
  console.log(`\n  ${C.magenta}${C.bold}► What to say to the Panel:${C.reset}`);
  console.log(`    "${stepData.narrative}"`);
  console.log(`${C.dim}--------------------------------------------------------------------------------${C.reset}`);
}

async function runInteractive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptUser = (query) => new Promise((resolve) => rl.question(query, resolve));

  printHeader();
  console.log(`${C.yellow}Open the Admin Dashboard in your browser: ${C.bold}http://localhost:5173/admin${C.reset}`);
  console.log(`${C.yellow}Watch the gauges, alert badges, and siren status update in real time as you step through.${C.reset}\n`);

  await promptUser(`${C.cyan}${C.bold}Press [Enter] to begin Step 1...${C.reset}`);

  for (let i = 0; i < SHOWCASE_STEPS.length; i++) {
    const s = SHOWCASE_STEPS[i];
    process.stdout.write(`Sending telemetry for Step ${s.step}... `);
    const result = await sendTelemetry(s);
    console.log('Done.');
    printStep(s, result);

    if (i < SHOWCASE_STEPS.length - 1) {
      await promptUser(`\n${C.cyan}${C.bold}Press [Enter] to advance to Step ${i + 2}...${C.reset}`);
    }
  }

  console.log(`\n${C.green}${C.bold}✓ Showcase demo sequence completed successfully!${C.reset}`);
  console.log(`${C.dim}You can re-run anytime with: npm run showcase${C.reset}\n`);
  rl.close();
}

async function runAuto() {
  printHeader();
  console.log(`${C.yellow}Automated demonstration started. Updating live dashboard every 6 seconds...${C.reset}\n`);

  for (let i = 0; i < SHOWCASE_STEPS.length; i++) {
    const s = SHOWCASE_STEPS[i];
    const result = await sendTelemetry(s);
    printStep(s, result);
    if (i < SHOWCASE_STEPS.length - 1) {
      await new Promise((r) => setTimeout(r, 6000));
    }
  }

  console.log(`\n${C.green}${C.bold}✓ Automated showcase sequence finished.${C.reset}\n`);
}

if (isAuto) {
  runAuto();
} else {
  runInteractive();
}
