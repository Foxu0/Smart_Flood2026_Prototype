#!/usr/bin/env node
/**
 * Board simulator — behaves like an ESP32 running the Smart Flood firmware.
 * Development / demo tool only (not the real firmware).
 *
 *   npm run simulate:board -- 7KQ2-9XPM-H4TD 200     (board code, distance to water in cm)
 *   TELEMETRY_URL=http://localhost:3001/api/v1/telemetry  (default)
 *
 * Every 5 seconds it sends a reading with its board code (X-Device-Key header).
 * Until staff add the board on the Hardware page (by typing the code from the sticker),
 * the server answers "not assigned yet" and does not save the reading.
 */
const code = process.argv[2];
if (!code) {
  console.log('Usage: npm run simulate:board -- <board code> [distance cm]\nMake a code with: npm run board:new-code');
  process.exit(1);
}
let distanceCm = parseFloat(process.argv[3] || '200');
const URL = process.env.TELEMETRY_URL || 'http://localhost:3001/api/v1/telemetry';
const EVERY_MS = parseInt(process.env.SIM_INTERVAL_MS || '5000', 10);

async function sendReading() {
  distanceCm = Math.max(30, distanceCm + (Math.random() - 0.5) * 1.5); // small wobble
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Key': code },
      body: JSON.stringify({ rawDistance: +distanceCm.toFixed(1), firmware_version: 'sim-1.0' }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 202) console.log(`[${code}] on, not assigned yet — add it on the Hardware page`);
    else if (res.status === 201) console.log(`[${code}] reading saved: ${body.log?.water_level_m ?? body.log?.waterLevelM ?? '?'} m`);
    else console.log(`[${code}] ${res.status} ${body.error || ''}`);
  } catch (err) {
    console.log(`[${code}] cannot reach ${URL}: ${err.message}`);
  }
}

console.log(`Simulating board ${code} → ${URL} (every ${EVERY_MS / 1000}s). Ctrl+C to stop.`);
sendReading();
setInterval(sendReading, EVERY_MS);
