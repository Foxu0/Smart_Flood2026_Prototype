import 'dotenv/config';

const TARGET_URL = process.env.API_URL || 'http://localhost:3001/api/v1/telemetry';

// 25-Step Physically Grounded Hydrological Storm Curve
const STEPS = [
  // Steps 1–5: Baseline Dry State (0.35m)
  { step: 1,  stage: 0.35, rainTips: 0,  voltage: 12.4, rssi: -65, uptime: 300,  comment: 'Steps 1–5: Baseline Dry State (0.35m stage)' },
  { step: 2,  stage: 0.35, rainTips: 0,  voltage: 12.4, rssi: -65, uptime: 900,  comment: 'Baseline Dry State' },
  { step: 3,  stage: 0.34, rainTips: 0,  voltage: 12.4, rssi: -66, uptime: 1500, comment: 'Baseline Dry State' },
  { step: 4,  stage: 0.35, rainTips: 0,  voltage: 12.3, rssi: -65, uptime: 2100, comment: 'Baseline Dry State' },
  { step: 5,  stage: 0.36, rainTips: 0,  voltage: 12.3, rssi: -65, uptime: 2700, comment: 'Baseline Dry State' },

  // Steps 6–10: Rain Onset (45 mm/h)
  { step: 6,  stage: 0.40, rainTips: 12, voltage: 12.3, rssi: -67, uptime: 3300, comment: 'Steps 6–10: Rain Onset (45 mm/h)' },
  { step: 7,  stage: 0.45, rainTips: 12, voltage: 12.2, rssi: -68, uptime: 3900, comment: 'Rain Onset — Level rising' },
  { step: 8,  stage: 0.50, rainTips: 12, voltage: 12.2, rssi: -68, uptime: 4500, comment: 'Rain Onset — Stage 0.50m' },
  { step: 9,  stage: 0.58, rainTips: 12, voltage: 12.1, rssi: -70, uptime: 5100, comment: 'Rain Onset — Stage 0.58m' },
  { step: 10, stage: 0.65, rainTips: 12, voltage: 12.1, rssi: -70, uptime: 5700, comment: 'Rain Onset — Stage 0.65m' },

  // Steps 11–16: Torrential Storm Surge Peak (80 mm/h)
  { step: 11, stage: 0.78, rainTips: 22, voltage: 12.1, rssi: -72, uptime: 6300, comment: 'Steps 11–16: Torrential Storm Surge (80 mm/h)' },
  { step: 12, stage: 0.92, rainTips: 22, voltage: 12.0, rssi: -73, uptime: 6900, comment: 'Storm Surge — Approaching Level 1' },
  { step: 13, stage: 1.08, rainTips: 22, voltage: 12.0, rssi: -75, uptime: 7500, comment: 'ALERT LEVEL 1: Advisory Watch (1.08m)' },
  { step: 14, stage: 1.22, rainTips: 22, voltage: 11.9, rssi: -76, uptime: 8100, comment: 'Storm Surge — Rapid Rise (1.22m)' },
  { step: 15, stage: 1.35, rainTips: 22, voltage: 11.9, rssi: -78, uptime: 8700, comment: 'Approaching Level 2 Siren Alarm' },
  { step: 16, stage: 1.45, rainTips: 22, voltage: 11.9, rssi: -78, uptime: 9300, comment: 'ALERT LEVEL 2: Siren Warning Alarm (1.45m)' },

  // Steps 17–21: Rain Recession & Cresting
  { step: 17, stage: 1.40, rainTips: 2,  voltage: 12.0, rssi: -75, uptime: 9900, comment: 'Steps 17–21: Rain Recession & Cresting' },
  { step: 18, stage: 1.30, rainTips: 2,  voltage: 12.1, rssi: -72, uptime: 10500, comment: 'Recession — Stage dropping (1.30m)' },
  { step: 19, stage: 1.20, rainTips: 2,  voltage: 12.1, rssi: -70, uptime: 11100, comment: 'Recession — Stage dropping (1.20m)' },
  { step: 20, stage: 1.08, rainTips: 2,  voltage: 12.2, rssi: -68, uptime: 11700, comment: 'Recession — Level 1 Watch (1.08m)' },
  { step: 21, stage: 0.95, rainTips: 2,  voltage: 12.3, rssi: -66, uptime: 12300, comment: 'Recession — Sub-Advisory (0.95m)' },

  // Steps 22–25: Recovery & Drainage
  { step: 22, stage: 0.80, rainTips: 0,  voltage: 12.3, rssi: -66, uptime: 12900, comment: 'Steps 22–25: Recovery & Drainage' },
  { step: 23, stage: 0.65, rainTips: 0,  voltage: 12.4, rssi: -65, uptime: 13500, comment: 'Recovery — Stage 0.65m' },
  { step: 24, stage: 0.52, rainTips: 0,  voltage: 12.4, rssi: -65, uptime: 14100, comment: 'Recovery — Stage 0.52m' },
  { step: 25, stage: 0.45, rainTips: 0,  voltage: 12.4, rssi: -65, uptime: 14700, comment: 'Recovery — Settled to Baseline (0.45m)' },
];

async function runSimulation() {
  console.log(`\n🌊 ========================================================`);
  console.log(`   SmartFlood 2026 — Hydrological Storm Simulator`);
  console.log(`   Target API: ${TARGET_URL}`);
  console.log(`   Total Timesteps: ${STEPS.length} (250 minutes simulated storm)`);
  console.log(`   Pacing: 2.5s per step | Surge scaling: dh / 0.1667 hr`);
  console.log(`========================================================\n`);

  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    const rawDistance = Math.max(15, Math.round(180 - step.stage * 100));

    const payload = {
      rawDistance,
      rainTips:       step.rainTips,
      batteryVoltage: step.voltage,
      wifiRssi:       step.rssi,
      uptime:         step.uptime,
      relayState:     step.stage >= 1.4,
    };

    try {
      const res = await fetch(TARGET_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      const data = await res.json();
      const status = res.status === 201 ? 'OK' : 'ERR';
      const pred = data.projection ? `+30m:${data.projection.horizon_30m_m}m (+60m:${data.projection.horizon_60m_m}m) [${data.projection.methodUsed}]` : 'N/A';

      console.log(`[Step ${String(i + 1).padStart(2, '0')}/${STEPS.length}] [${status}] ${step.comment}`);
      console.log(`         Stage: ${step.stage.toFixed(2)}m | Distance: ${rawDistance}cm | Tips: ${step.rainTips} | ONNX: ${pred}\n`);
    } catch (err) {
      console.error(`[Step ${i + 1}] Request failed:`, err.message);
    }

    // Pacing delay: 2.5s between steps
    await new Promise((r) => setTimeout(r, 2500));
  }

  console.log(`\n✅ Storm Simulation Complete! Check your Dashboard for live updates.\n`);
}

runSimulation();
