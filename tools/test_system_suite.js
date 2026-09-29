// SmartFlood 2026 — Comprehensive System-Wide Test Suite
// Verifies all layers: REST APIs, Calibration (240cm), Ingestion, Thresholds, Siren Logic,
// ONNX LSTM Neural Inference, Email Subscriber defaults, WebSockets, and Simulator GUI.

import { WebSocket } from 'ws';

const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const WS_URL = process.env.WS_URL || 'ws://localhost:3001';
const SIMULATOR_URL = 'http://localhost:5174';

const results = [];
function record(section, testName, passed, detail = '') {
  results.push({ section, testName, passed, detail });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} [${section}] ${testName} ${detail ? `(${detail})` : ''}`);
}

async function runTests() {
  console.log('\n============================================================');
  console.log('   🧪 STARTING SMARTFLOOD COMPREHENSIVE SYSTEM TEST SUITE   ');
  console.log('============================================================\n');

  // ── SECTION 1: API & HEALTH CHECKS ─────────────────────────────────────────
  try {
    const res = await fetch(`${BASE_URL}/api/v1/health`);
    const data = await res.json();
    record('API Health', 'GET /api/v1/health', res.ok && data.status === 'OK', `Status: ${data.status}`);
  } catch (err) {
    record('API Health', 'GET /api/v1/health', false, err.message);
  }

  try {
    const res = await fetch(`${BASE_URL}/api/v1/weather`);
    const data = await res.json();
    const location = data.data?.location;
    const temp = data.data?.temperature_c;
    const rain = data.data?.rain_1h_mm ?? 0;
    record('Weather API', 'GET /api/v1/weather (Antipolo)', res.ok && data.success && location === 'Antipolo City', `Location: ${location}, Temp: ${temp}°C, Rain: ${rain}mm/h`);
  } catch (err) {
    record('Weather API', 'GET /api/v1/weather', false, err.message);
  }

  // ── SECTION 2: ADMIN AUTHENTICATION ────────────────────────────────────────
  let authToken = '';
  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'smartflood2026' }),
    });
    const data = await res.json();
    authToken = data.token;
    record('Auth', 'Admin JWT Login', res.ok && !!authToken, `Token acquired (length: ${authToken?.length})`);
  } catch (err) {
    record('Auth', 'Admin JWT Login', false, err.message);
  }

  // ── SECTION 3: WEBSOCKET REAL-TIME BROADCAST LISTENER ───────────────────────
  let wsReceivedTelemetry = false;
  let wsReceivedAlert = false;
  let wsConnected = false;
  const ws = new WebSocket(WS_URL);

  await new Promise((resolve) => {
    ws.on('open', () => {
      wsConnected = true;
      record('WebSocket', 'Connection Established', true, 'Connected to ws://localhost:3001');
      resolve();
    });
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'TELEMETRY') wsReceivedTelemetry = true;
        if (msg.type === 'ALERT_STATUS') wsReceivedAlert = true;
      } catch {}
    });
    ws.on('error', (err) => {
      record('WebSocket', 'Connection', false, err.message);
      resolve();
    });
    // Timeout if WS doesn't connect within 3s
    setTimeout(resolve, 3000);
  });

  // ── SECTION 4: TELEMETRY INGESTION & THRESHOLDS (240cm Mount Height) ───────
  // Test 4A: Baseline Dry (rawDistance: 240cm -> Stage: 0.00m -> Level 0 NORMAL, Siren OFF)
  try {
    const res = await fetch(`${BASE_URL}/api/v1/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawDistance: 240,
        batteryVoltage: 12.4,
        wifiRssi: -58,
        uptime: 100,
        relayState: false,
      }),
    });
    const data = await res.json();
    const stage = parseFloat(data.log?.waterLevelM ?? -1);
    const level = data.alertStatus?.level;
    const sirenActive = level >= 2;
    const ok = res.ok && Math.abs(stage - 0.00) < 0.05 && level === 0 && !sirenActive;
    record('Telemetry & Thresholds', 'Test 4A: Dry Bed (240cm -> 0.00m)', ok, `Stage: ${stage}m, Level: ${level}, Siren: ${sirenActive ? 'ON' : 'OFF'}`);
  } catch (err) {
    record('Telemetry & Thresholds', 'Test 4A: Dry Bed', false, err.message);
  }

  // Test 4B: Level 1 Advisory (rawDistance: 115cm -> Stage: 1.25m >= 1.20m -> ALERT_L1, Siren OFF)
  try {
    const res = await fetch(`${BASE_URL}/api/v1/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawDistance: 115,
        batteryVoltage: 12.4,
        wifiRssi: -58,
        uptime: 105,
        relayState: false,
      }),
    });
    const data = await res.json();
    const stage = parseFloat(data.log?.waterLevelM ?? -1);
    const level = data.alertStatus?.level;
    const code = data.alertStatus?.eventCode;
    const sirenActive = level >= 2;
    const ok = res.ok && Math.abs(stage - 1.25) < 0.05 && level === 1 && code === 'ALERT_L1' && !sirenActive;
    record('Telemetry & Thresholds', 'Test 4B: Level 1 Advisory (115cm -> 1.25m)', ok, `Stage: ${stage}m, Status: ${code}, Siren: ${sirenActive ? 'ON' : 'OFF'}`);
  } catch (err) {
    record('Telemetry & Thresholds', 'Test 4B: Level 1 Advisory', false, err.message);
  }

  // Test 4C: Level 2 Warning & Siren (rawDistance: 75cm -> Stage: 1.65m >= 1.60m -> ALERT_L2, Siren ON)
  try {
    const res = await fetch(`${BASE_URL}/api/v1/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawDistance: 75,
        batteryVoltage: 12.1,
        wifiRssi: -58,
        uptime: 110,
        relayState: true,
      }),
    });
    const data = await res.json();
    const stage = parseFloat(data.log?.waterLevelM ?? -1);
    const level = data.alertStatus?.level;
    const code = data.alertStatus?.eventCode;
    const sirenActive = level >= 2;
    const ok = res.ok && Math.abs(stage - 1.65) < 0.05 && level === 2 && code === 'ALERT_L2' && sirenActive;
    record('Telemetry & Thresholds', 'Test 4C: Level 2 Warning (75cm -> 1.65m)', ok, `Stage: ${stage}m, Status: ${code}, Siren: ${sirenActive ? 'ON 🚨' : 'OFF'}`);
  } catch (err) {
    record('Telemetry & Thresholds', 'Test 4C: Level 2 Warning', false, err.message);
  }

  // Test 4D: Level 3 Danger Crest (rawDistance: 35cm -> Stage: 2.05m >= 2.00m -> ALERT_L3, Siren ON)
  try {
    const res = await fetch(`${BASE_URL}/api/v1/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawDistance: 35,
        batteryVoltage: 12.0,
        wifiRssi: -58,
        uptime: 115,
        relayState: true,
      }),
    });
    const data = await res.json();
    const stage = parseFloat(data.log?.waterLevelM ?? -1);
    const level = data.alertStatus?.level;
    const code = data.alertStatus?.eventCode;
    const sirenActive = level >= 2;
    const ok = res.ok && Math.abs(stage - 2.05) < 0.05 && level === 3 && code === 'ALERT_L3' && sirenActive;
    record('Telemetry & Thresholds', 'Test 4D: Level 3 Danger Crest (35cm -> 2.05m)', ok, `Stage: ${stage}m, Status: ${code}, Siren: ${sirenActive ? 'ON 🚨' : 'OFF'}`);
  } catch (err) {
    record('Telemetry & Thresholds', 'Test 4D: Level 3 Danger Crest', false, err.message);
  }

  // Test 4E: JSN-SR04T Blind Spot Handling (rawDistance: 20cm <= 25cm BLIND SPOT)
  try {
    const res = await fetch(`${BASE_URL}/api/v1/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawDistance: 20,
        batteryVoltage: 12.0,
        wifiRssi: -58,
        uptime: 120,
        relayState: true,
      }),
    });
    const data = await res.json();
    const status = data.log?.sensorStatus;
    const ok = res.ok && status === 'BLIND_SPOT';
    record('Telemetry & Thresholds', 'Test 4E: Blind Spot Guard (20cm <= 25cm)', ok, `Sensor Status: ${status}`);
  } catch (err) {
    record('Telemetry & Thresholds', 'Test 4E: Blind Spot Guard', false, err.message);
  }

  // ── SECTION 5: ONNX LSTM DEEP LEARNING INFERENCE ────────────────────────────
  try {
    const res = await fetch(`${BASE_URL}/api/v1/telemetry/projection`);
    const data = await res.json();
    const p30 = parseFloat(data.data?.horizon30mM ?? -1);
    const p60 = parseFloat(data.data?.horizon60mM ?? -1);
    const conf = data.data?.confidenceScore;
    const ok = res.ok && data.success && p30 >= 0 && p60 >= 0;
    record('ONNX LSTM AI', 'Neural Forecast Projection', ok, `+30m: ${p30}m, +60m: ${p60}m, Conf: ${conf}%`);
  } catch (err) {
    record('ONNX LSTM AI', 'Neural Forecast Projection', false, err.message);
  }

  // ── SECTION 6: EMAIL SUBSCRIBER DIRECTORY & DEFAULT LEVEL 1+ ───────────────
  let testSubId = null;
  const testEmail = `test.resident.${Date.now()}@example.com`;
  try {
    // Intentionally omit minAlertLevel to test default Level 1+ fallback
    const res = await fetch(`${BASE_URL}/api/v1/subscribers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        fullName: 'Juan Dela Cruz (System Test)',
      }),
    });
    const data = await res.json();
    testSubId = data.data?.id;
    const defaultLevel = data.data?.minAlertLevel;
    const ok = res.ok && data.success && defaultLevel === 1;
    record('Subscribers', 'Register Resident (Default Level 1+ Fallback)', ok, `Sub ID: ${testSubId}, minAlertLevel: ${defaultLevel}`);
  } catch (err) {
    record('Subscribers', 'Register Resident (Default Level 1+ Fallback)', false, err.message);
  }

  try {
    const res = await fetch(`${BASE_URL}/api/v1/subscribers`);
    const data = await res.json();
    const found = data.subscribers?.some((s) => s.email === testEmail);
    record('Subscribers', 'Fetch Subscriber Directory', res.ok && data.success && found, `Total Subscribers: ${data.stats?.total}`);
  } catch (err) {
    record('Subscribers', 'Fetch Subscriber Directory', false, err.message);
  }

  try {
    const res = await fetch(`${BASE_URL}/api/v1/subscribers/test-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toEmail: testEmail, level: 1 }),
    });
    const data = await res.json();
    record('Subscribers', 'Test Email Advisory Dispatch', res.ok && data.success, data.message || 'Dispatched');
  } catch (err) {
    record('Subscribers', 'Test Email Advisory Dispatch', false, err.message);
  }

  // Cleanup test subscriber
  if (testSubId && authToken) {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/subscribers/${testSubId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      record('Subscribers', 'Cleanup Test Subscriber (Admin Auth)', res.ok && data.success, `Sub ID ${testSubId} removed`);
    } catch (err) {
      record('Subscribers', 'Cleanup Test Subscriber', false, err.message);
    }
  }

  // ── SECTION 7: VERIFY WEBSOCKET BROADCAST DELIVERIES ────────────────────────
  await new Promise((r) => setTimeout(r, 600));
  record('WebSocket', 'Live Telemetry Broadcast Received', wsReceivedTelemetry, 'TELEMETRY frame captured');
  record('WebSocket', 'Live Alert Status Frame Received', wsReceivedAlert, 'ALERT_STATUS frame captured');
  if (wsConnected) ws.close();

  // ── SECTION 8: SIMULATOR GUI SERVER CHECK ──────────────────────────────────
  try {
    const res = await fetch(SIMULATOR_URL);
    const html = await res.text();
    const hasCircuitUI = html.includes('ESP32-WROOM-32') || html.includes('SmartFlood') || res.ok;
    record('Simulator GUI', 'ESP32 Hardware Circuit Server', res.ok && hasCircuitUI, `Status: ${res.status}, URL: ${SIMULATOR_URL}`);
  } catch (err) {
    record('Simulator GUI', 'ESP32 Hardware Circuit Server', false, err.message);
  }

  // ── FINAL SUMMARY ──────────────────────────────────────────────────────────
  console.log('\n============================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  console.log(`📊 SYSTEM TEST RESULTS: ${passedCount}/${totalCount} TESTS PASSED`);
  console.log('============================================================\n');

  if (passedCount === totalCount) {
    console.log('🎉 ALL SYSTEM COMPONENTS FULLY OPERATIONAL AND VERIFIED!\n');
    process.exit(0);
  } else {
    console.error('⚠️ SOME TESTS FAILED. CHECK DETAILS ABOVE.\n');
    process.exit(1);
  }
}

runTests();
