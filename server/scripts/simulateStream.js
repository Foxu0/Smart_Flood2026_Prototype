import 'dotenv/config';

const TARGET_URL = process.env.API_URL || 'http://localhost:3001/api/v1/telemetry';

// 20-Step Calibrated Hydrological Hydrograph Matching Trained LSTM Dynamics
const STEPS = [
  { step: 1,  stage: 0.35, rain: 0.0,  voltage: 12.4, rssi: -65, uptime: 300,  comment: "Dry Baseline (0 mm/h)" },
  { step: 2,  stage: 0.35, rain: 0.0,  voltage: 12.4, rssi: -65, uptime: 900,  comment: "Dry Baseline (0 mm/h)" },
  { step: 3,  stage: 0.35, rain: 0.0,  voltage: 12.4, rssi: -65, uptime: 1500, comment: "Dry Baseline (0 mm/h)" },
  { step: 4,  stage: 0.36, rain: 12.0, voltage: 12.3, rssi: -65, uptime: 2100, comment: "Light Rain Onset (12 mm/h)" },
  { step: 5,  stage: 0.42, rain: 28.0, voltage: 12.3, rssi: -66, uptime: 2700, comment: "Moderate Rain (28 mm/h)" },
  { step: 6,  stage: 0.55, rain: 45.0, voltage: 12.2, rssi: -67, uptime: 3300, comment: "Heavy Rain Onset (45 mm/h)" },
  { step: 7,  stage: 0.75, rain: 60.0, voltage: 12.2, rssi: -68, uptime: 3900, comment: "Intense Rainfall (60 mm/h)" },
  { step: 8,  stage: 1.05, rain: 65.0, voltage: 12.1, rssi: -70, uptime: 4500, comment: "Surge Crossing Level 1 Watch (65 mm/h)" },
  { step: 9,  stage: 1.35, rain: 50.0, voltage: 12.0, rssi: -72, uptime: 5100, comment: "Surge Approaching Level 2 Siren Alarm (50 mm/h)" },
  { step: 10, stage: 1.55, rain: 35.0, voltage: 12.0, rssi: -74, uptime: 5700, comment: "Crest at Warning Level 2 (35 mm/h)" },
  { step: 11, stage: 1.62, rain: 20.0, voltage: 11.9, rssi: -76, uptime: 6300, comment: "Peak Crest (20 mm/h)" },
  { step: 12, stage: 1.58, rain: 10.0, voltage: 12.0, rssi: -74, uptime: 6900, comment: "Rain Subsiding (10 mm/h)" },
  { step: 13, stage: 1.45, rain: 5.0,  voltage: 12.1, rssi: -72, uptime: 7500, comment: "Recession Phase (5 mm/h)" },
  { step: 14, stage: 1.25, rain: 0.0,  voltage: 12.2, rssi: -70, uptime: 8100, comment: "Recession (0 mm/h)" },
  { step: 15, stage: 1.05, rain: 0.0,  voltage: 12.2, rssi: -68, uptime: 8700, comment: "Drainage (0 mm/h)" },
  { step: 16, stage: 0.85, rain: 0.0,  voltage: 12.3, rssi: -66, uptime: 9300, comment: "Drainage (0 mm/h)" },
  { step: 17, stage: 0.65, rain: 0.0,  voltage: 12.3, rssi: -66, uptime: 9900, comment: "Drainage (0 mm/h)" },
  { step: 18, stage: 0.50, rain: 0.0,  voltage: 12.4, rssi: -65, uptime: 10500, comment: "Recovery (0 mm/h)" },
  { step: 19, stage: 0.40, rain: 0.0,  voltage: 12.4, rssi: -65, uptime: 11100, comment: "Recovery (0 mm/h)" },
  { step: 20, stage: 0.35, rain: 0.0,  voltage: 12.4, rssi: -65, uptime: 11700, comment: "Normal Baseline Restored" },
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
      rainfall_rate:  step.rain || 0,
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
      console.log(`         Stage: ${step.stage.toFixed(2)}m | Distance: ${rawDistance}cm | Rain: ${step.rain}mm/h | ONNX: ${pred}\n`);
    } catch (err) {
      console.error(`[Step ${i + 1}] Request failed:`, err.message);
    }

    // Pacing delay: 2.5s between steps
    await new Promise((r) => setTimeout(r, 2500));
  }

  console.log(`\n✅ Calibrated Storm Simulation Complete! Check your Dashboard for live updates.\n`);
}

runSimulation();
