import 'dotenv/config';

const TARGET_URL = process.env.API_URL || 'http://localhost:3001/api/v1/telemetry';

// 20-Timestep Realistic Hydrological Storm Cycle
const STEPS = [
  // Phase 1: Baseline Dry State (0–30 mins)
  { min: 0,   rawDistance: 150.0, rainTips: 0,  voltage: 12.4, rssi: -65, uptime: 300,  relay: false, comment: 'Phase 1: Baseline Dry State (0.30m stage)' },
  { min: 10,  rawDistance: 150.0, rainTips: 0,  voltage: 12.4, rssi: -65, uptime: 900,  relay: false, comment: 'Phase 1: Baseline Dry State' },
  { min: 20,  rawDistance: 149.5, rainTips: 0,  voltage: 12.4, rssi: -66, uptime: 1500, relay: false, comment: 'Phase 1: Baseline Dry State' },
  { min: 30,  rawDistance: 148.0, rainTips: 1,  voltage: 12.3, rssi: -65, uptime: 2100, relay: false, comment: 'Phase 1: Light Rain Start' },

  // Phase 2: Heavy Rainfall Onset (30–70 mins)
  { min: 40,  rawDistance: 142.0, rainTips: 12, voltage: 12.3, rssi: -67, uptime: 2700, relay: false, comment: 'Phase 2: Heavy Rain Onset (45 mm/h)' },
  { min: 50,  rawDistance: 135.0, rainTips: 18, voltage: 12.2, rssi: -68, uptime: 3300, relay: false, comment: 'Phase 2: Rain Intensifies (68 mm/h)' },
  { min: 60,  rawDistance: 125.0, rainTips: 22, voltage: 12.2, rssi: -68, uptime: 3900, relay: false, comment: 'Phase 2: Stage Rising (0.55m)' },
  { min: 70,  rawDistance: 115.0, rainTips: 25, voltage: 12.1, rssi: -70, uptime: 4500, relay: false, comment: 'Phase 2: Approaching Advisory Watch' },

  // Phase 3: Flash Flood Surge / Peak (70–130 mins)
  { min: 80,  rawDistance: 95.0,  rainTips: 32, voltage: 12.1, rssi: -72, uptime: 5100, relay: false, comment: 'Phase 3: ALERT L1 Watch (0.85m stage)' },
  { min: 90,  rawDistance: 75.0,  rainTips: 35, voltage: 12.0, rssi: -73, uptime: 5700, relay: false, comment: 'Phase 3: ALERT L1 Watch (1.05m stage)' },
  { min: 100, rawDistance: 55.0,  rainTips: 40, voltage: 12.0, rssi: -75, uptime: 6300, relay: true,  comment: 'Phase 3: ALERT L2 Siren Alarm (1.25m)' },
  { min: 110, rawDistance: 35.0,  rainTips: 38, voltage: 11.9, rssi: -76, uptime: 6900, relay: true,  comment: 'Phase 3: ALERT L2 Siren Alarm (1.45m)' },
  { min: 120, rawDistance: 15.0,  rainTips: 30, voltage: 11.9, rssi: -78, uptime: 7500, relay: true,  comment: 'Phase 3: ALERT L3 Emergency Peak (1.65m)' },

  // Phase 4: Rain Recession & Crest (130–170 mins)
  { min: 130, rawDistance: 20.0,  rainTips: 15, voltage: 11.9, rssi: -75, uptime: 8100, relay: true,  comment: 'Phase 4: Rain Easing, Water Cresting (1.60m)' },
  { min: 140, rawDistance: 35.0,  rainTips: 6,  voltage: 12.0, rssi: -72, uptime: 8700, relay: true,  comment: 'Phase 4: Stage Receding (1.45m)' },
  { min: 150, rawDistance: 55.0,  rainTips: 3,  voltage: 12.1, rssi: -70, uptime: 9300, relay: false, comment: 'Phase 4: Returning to Level 2 (1.25m)' },
  { min: 160, rawDistance: 70.0,  rainTips: 1,  voltage: 12.2, rssi: -68, uptime: 9900, relay: false, comment: 'Phase 4: Returning to Level 1 (1.10m)' },

  // Phase 5: Drainage / Recovery (170–200 mins)
  { min: 170, rawDistance: 95.0,  rainTips: 0,  voltage: 12.3, rssi: -66, uptime: 10500, relay: false, comment: 'Phase 5: Drainage / Recovery (0.85m)' },
  { min: 180, rawDistance: 120.0, rainTips: 0,  voltage: 12.4, rssi: -65, uptime: 11100, relay: false, comment: 'Phase 5: Drainage / Recovery (0.60m)' },
  { min: 190, rawDistance: 135.0, rainTips: 0,  voltage: 12.4, rssi: -65, uptime: 11700, relay: false, comment: 'Phase 5: Drainage / Recovery (0.45m)' },
  { min: 200, rawDistance: 145.0, rainTips: 0,  voltage: 12.4, rssi: -65, uptime: 12300, relay: false, comment: 'Phase 5: Baseline Restored (0.35m)' },
];

async function runSimulation() {
  console.log(`\n🌊 ========================================================`);
  console.log(`   SmartFlood 2026 — Hydrological Storm Simulator`);
  console.log(`   Target API: ${TARGET_URL}`);
  console.log(`   Total Timesteps: ${STEPS.length} (200 minutes simulated storm)`);
  console.log(`========================================================\n`);

  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    const payload = {
      rawDistance:    step.rawDistance,
      rainTips:       step.rainTips,
      batteryVoltage: step.voltage,
      wifiRssi:       step.rssi,
      uptime:         step.uptime,
      relayState:     step.relay,
    };

    const calculatedStage = ((180 - step.rawDistance) / 100).toFixed(2);

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
      console.log(`         Stage: ${calculatedStage}m | Distance: ${step.rawDistance}cm | Tips: ${step.rainTips} | ONNX: ${pred}\n`);
    } catch (err) {
      console.error(`[Step ${i + 1}] Request failed:`, err.message);
    }

    // Delay 1.5s between steps for realistic streaming
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(`\n✅ Storm Simulation Complete! Check your Dashboard for live updates.\n`);
}

runSimulation();
