import 'dotenv/config';

const TARGET_URL = process.env.API_URL || 'http://localhost:3001/api/v1/telemetry';

// 20-Step Calibrated Hydrological Hydrograph Matching Trained LSTM Dynamics
const STEPS = [
  { step: 1,  stage: 0.35, voltage: 12.4, rssi: -65, uptime: 300,  comment: "Dry Baseline" },
  { step: 2,  stage: 0.35, voltage: 12.4, rssi: -65, uptime: 900,  comment: "Dry Baseline" },
  { step: 3,  stage: 0.35, voltage: 12.4, rssi: -65, uptime: 1500, comment: "Dry Baseline" },
  { step: 4,  stage: 0.36, voltage: 12.3, rssi: -65, uptime: 2100, comment: "Inflow Onset (0.36m)" },
  { step: 5,  stage: 0.42, voltage: 12.3, rssi: -66, uptime: 2700, comment: "Moderate Inflow (0.42m)" },
  { step: 6,  stage: 0.55, voltage: 12.2, rssi: -67, uptime: 3300, comment: "Stream Velocity Rising (0.55m)" },
  { step: 7,  stage: 0.75, voltage: 12.2, rssi: -68, uptime: 3900, comment: "Surge Building (0.75m)" },
  { step: 8,  stage: 1.05, voltage: 12.1, rssi: -70, uptime: 4500, comment: "Surge Crossing Level 1 Watch (1.05m)" },
  { step: 9,  stage: 1.35, voltage: 12.0, rssi: -72, uptime: 5100, comment: "Surge Approaching Level 2 Siren Alarm (1.35m)" },
  { step: 10, stage: 1.55, voltage: 12.0, rssi: -74, uptime: 5700, comment: "Crest at Warning Level 2 (1.55m)" },
  { step: 11, stage: 1.62, voltage: 11.9, rssi: -76, uptime: 6300, comment: "Peak Crest Level 3 (1.62m)" },
  { step: 12, stage: 1.58, voltage: 12.0, rssi: -74, uptime: 6900, comment: "Inflow Subsiding (1.58m)" },
  { step: 13, stage: 1.45, voltage: 12.1, rssi: -72, uptime: 7500, comment: "Recession Phase (1.45m)" },
  { step: 14, stage: 1.25, voltage: 12.2, rssi: -70, uptime: 8100, comment: "Recession (1.25m)" },
  { step: 15, stage: 1.05, voltage: 12.2, rssi: -68, uptime: 8700, comment: "Drainage (1.05m)" },
  { step: 16, stage: 0.85, voltage: 12.3, rssi: -66, uptime: 9300, comment: "Drainage (0.85m)" },
  { step: 17, stage: 0.65, voltage: 12.3, rssi: -66, uptime: 9900, comment: "Drainage (0.65m)" },
  { step: 18, stage: 0.50, voltage: 12.4, rssi: -65, uptime: 10500, comment: "Recovery (0.50m)" },
  { step: 19, stage: 0.40, voltage: 12.4, rssi: -65, uptime: 11100, comment: "Recovery (0.40m)" },
  { step: 20, stage: 0.35, voltage: 12.4, rssi: -65, uptime: 11700, comment: "Normal Baseline Restored (0.35m)" },
];

async function runSimulation() {
  console.log(`\n🌊 ========================================================`);
  console.log(`   SmartFlood 2026 — Hydrological Storm Simulator`);
  console.log(`   Target API: ${TARGET_URL}`);
  console.log(`   Total Timesteps: ${STEPS.length} (200 minutes simulated storm)`);
  console.log(`   Pacing: 2.5s per step | Calibrated Hydrograph`);
  console.log(`========================================================\n`);

  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    const rawDistance = Math.max(15, Math.round(180 - step.stage * 100));

    const payload = {
      rawDistance,
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
      console.log(`         Stage: ${step.stage.toFixed(2)}m | Distance: ${rawDistance}cm | ONNX: ${pred}\n`);
    } catch (err) {
      console.error(`[Step ${i + 1}] Request failed:`, err.message);
    }

    // Pacing delay: 2.5s between steps
    await new Promise((r) => setTimeout(r, 2500));
  }

  console.log(`\n✅ Calibrated Storm Simulation Complete! Check your Dashboard for live updates.\n`);
}

runSimulation();
