/*
 * ==============================================================================
 * SMART FLOOD EARLY WARNING SYSTEM (2026 PROTOTYPE)
 * Node Firmware: ESP32 DevKit V1 (30-Pin)
 * Target Hardware: JSN-SR04T Ultrasonic Sensor + 5V Relay + Tipping Bucket + 12V ADC
 * ==============================================================================
 * WIRING CORRELATION TO 3D SCHEMATIC:
 *   - GPIO 5  : JSN-SR04T TRIG
 *   - GPIO 18 : JSN-SR04T ECHO (via 5.1k / 10k resistor voltage divider)
 *   - GPIO 23 : 5V Optocoupler Relay IN (12V Siren Horn control)
 *   - GPIO 34 : 12V Battery Sense (ADC1 via 5.1k / 1k voltage divider, 6.1x ratio)
 *   - GPIO 4  : Tipping Bucket Rain Gauge (Reed switch with internal pullup)
 *   - VIN     : 5.0V from LM2596 DC-DC Buck Converter (Cols 1-9 on breadboard)
 *   - GND     : Common Ground (WAGO 221-413 star ground + breadboard rail)
 * ==============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ── Wi-Fi Configuration ──────────────────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// ── Cloud / Local Server Endpoint ────────────────────────────────────────────
// Default: Live Cloud Prototype backend on Render
const char* SERVER_URL    = "https://smart-flood2026-prototype.onrender.com/api/v1/telemetry";
// For local LAN testing:
// const char* SERVER_URL = "http://192.168.1.19:3001/api/v1/telemetry";

// ── Pin Assignments (Aligned with 3D Expansion Schematic) ─────────────────────
const int PIN_TRIG        = 5;    // Ultrasonic Trigger
const int PIN_ECHO        = 18;   // Ultrasonic Echo (via 3.3V divider)
const int PIN_RELAY       = 23;   // Relay Module IN (Active HIGH or LOW)
const int PIN_BATTERY_ADC = 34;   // 12V Battery Voltage Divider (ADC1_CH6)
const int PIN_RAIN_GAUGE  = 4;    // Tipping Bucket Reed Switch

// ── Physical Constants & Calibration ──────────────────────────────────────────
const float MOUNT_HEIGHT_CM       = 240.0; // Sensor height above dry riverbed
const float BLIND_SPOT_MIN_CM     = 25.0;  // JSN-SR04T physical blind spot
const float SOUND_SPEED_CM_US     = 0.0343; // Speed of sound (cm/us)
const float BATTERY_DIVIDER_RATIO = 6.10;  // (5.1k + 1.0k) / 1.0k = 6.1x
const float LEVEL2_SIREN_THRESHOLD_M = 1.60; // Auto-siren threshold

// ── Timing & Sampling ─────────────────────────────────────────────────────────
const unsigned long TELEMETRY_INTERVAL_MS = 3000; // 3-second live stream
unsigned long lastTelemetryTime = 0;

// ── Rain Gauge Interrupt Tracker ──────────────────────────────────────────────
volatile unsigned long tipCount = 0;
volatile unsigned long lastTipDebounceTime = 0;
const unsigned long TIP_DEBOUNCE_MS = 150; // Debounce reed switch bounce

void IRAM_ATTR onRainTip() {
  unsigned long now = millis();
  if (now - lastTipDebounceTime > TIP_DEBOUNCE_MS) {
    tipCount++;
    lastTipDebounceTime = now;
  }
}

// ── 10-Sample Ultrasonic Median Filter (Eliminates Water Ripples) ─────────────
float getFilteredDistanceCm() {
  const int SAMPLES = 9;
  float readings[SAMPLES];
  int validCount = 0;

  for (int i = 0; i < SAMPLES; i++) {
    // 10us Trigger Pulse
    digitalWrite(PIN_TRIG, LOW);
    delayMicroseconds(4);
    digitalWrite(PIN_TRIG, HIGH);
    delayMicroseconds(10);
    digitalWrite(PIN_TRIG, LOW);

    // Measure echo pulse (timeout: 30ms = ~5m max range)
    unsigned long duration = pulseIn(PIN_ECHO, HIGH, 30000);
    if (duration > 0) {
      float dist = (duration * SOUND_SPEED_CM_US) / 2.0;
      if (dist >= 15.0 && dist <= 500.0) {
        readings[validCount++] = dist;
      }
    }
    delay(15); // Small delay between sound bursts
  }

  if (validCount == 0) return -1.0; // Sensor reading timeout / lost

  // Simple bubble sort to find median
  for (int i = 0; i < validCount - 1; i++) {
    for (int j = 0; j < validCount - i - 1; j++) {
      if (readings[j] > readings[j + 1]) {
        float temp = readings[j];
        readings[j] = readings[j + 1];
        readings[j + 1] = temp;
      }
    }
  }

  return readings[validCount / 2]; // Return median value
}

// ── Battery Voltage Calculation ───────────────────────────────────────────────
float getBatteryVoltage() {
  int rawAdc = analogRead(PIN_BATTERY_ADC);
  // ESP32 12-bit ADC (0-4095) with 3.3V reference
  float pinVoltage = (rawAdc / 4095.0) * 3.30;
  return pinVoltage * BATTERY_DIVIDER_RATIO;
}

// ── Format Uptime String (HH:MM:SS) ───────────────────────────────────────────
String getUptimeString() {
  unsigned long sec = millis() / 1000;
  int h = sec / 3600;
  int m = (sec % 3600) / 60;
  int s = sec % 60;
  char buf[16];
  snprintf(buf, sizeof(buf), "%02d:%02d:%02d", h, m, s);
  return String(buf);
}

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println(F("\n=================================================="));
  Serial.println(F(" SMART FLOOD 2026: ESP32 TELEMETRY & SIREN NODE   "));
  Serial.println(F("=================================================="));

  // Initialize GPIOs
  pinMode(PIN_TRIG, OUTPUT);
  digitalWrite(PIN_TRIG, LOW);
  pinMode(PIN_ECHO, INPUT);

  pinMode(PIN_RELAY, OUTPUT);
  digitalWrite(PIN_RELAY, LOW); // Siren OFF initially (Active HIGH)

  pinMode(PIN_BATTERY_ADC, INPUT);
  pinMode(PIN_RAIN_GAUGE, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_RAIN_GAUGE), onRainTip, FALLING);

  // Connect to Wi-Fi
  Serial.printf("Connecting to Wi-Fi: %s ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(400);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[Wi-Fi] Connected! IP: %s | RSSI: %d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println(F("\n[Wi-Fi] Offline. Node will operate in Autonomous Local Failsafe mode."));
  }
}

void loop() {
  unsigned long now = millis();

  if (now - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = now;

    // 1. Measure Distance & Calculate Water Level
    float distanceCm = getFilteredDistanceCm();
    if (distanceCm < 0) {
      Serial.println(F("[Sensor] JSN-SR04T echo timeout. Using fallback."));
      distanceCm = MOUNT_HEIGHT_CM;
    }

    // River stage = Mount Height - Ultrasonic distance
    float waterLevelM = (MOUNT_HEIGHT_CM - distanceCm) / 100.0;
    if (waterLevelM < 0.0) waterLevelM = 0.0;

    // 2. Battery & Rainfall
    float batteryV = getBatteryVoltage();
    unsigned long currentTips = tipCount;
    // Standard tipping bucket: 0.5 mm per tip
    float rainRateMmHr = (currentTips * 0.5); 

    // 3. Autonomous Local Siren Failsafe Logic
    // If water level reaches Level 2 (>= 1.60m), energize relay regardless of server status
    bool sirenShouldBeOn = (waterLevelM >= LEVEL2_SIREN_THRESHOLD_M);
    digitalWrite(PIN_RELAY, sirenShouldBeOn ? HIGH : LOW);
    String relayState = sirenShouldBeOn ? "ON" : "OFF";

    // 4. Output to Serial Monitor
    Serial.printf("[Telemetry] Stage: %.2fm | Dist: %.1fcm | Rain: %.1fmm/h (%lu tips) | Bat: %.2fV | Siren: %s\n",
                  waterLevelM, distanceCm, rainRateMmHr, currentTips, batteryV, relayState.c_str());

    // 5. Transmit Payload via HTTP POST if Wi-Fi Connected
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(SERVER_URL);
      http.addHeader("Content-Type", "application/json");

      StaticJsonDocument<384> doc;
      doc["rawDistance"]     = round(distanceCm * 10) / 10.0;
      doc["rainTips"]        = currentTips;
      doc["batteryVoltage"]  = round(batteryV * 10) / 10.0;
      doc["wifiRssi"]        = WiFi.RSSI();
      doc["uptime"]          = getUptimeString();
      doc["relayState"]      = relayState;
      // Direct stage fields for backwards compatibility
      doc["water_level_m"]   = round(waterLevelM * 100) / 100.0;
      doc["raw_distance_cm"] = round(distanceCm * 10) / 10.0;
      doc["rainfall_rate"]   = rainRateMmHr;
      doc["tip_count"]       = currentTips;
      doc["supply_voltage"]  = round(batteryV * 10) / 10.0;
      doc["sensor_status"]   = (distanceCm <= BLIND_SPOT_MIN_CM) ? "BLIND_SPOT" : "NORMAL";

      String requestBody;
      serializeJson(doc, requestBody);

      int httpResponseCode = http.POST(requestBody);
      if (httpResponseCode > 0) {
        Serial.printf("  --> Cloud Sync OK [HTTP %d]\n", httpResponseCode);
      } else {
        Serial.printf("  --> Cloud Sync Failed: %s\n", http.errorToString(httpResponseCode).c_str());
      }
      http.end();
    } else {
      // Attempt Wi-Fi reconnection periodically
      if (WiFi.status() != WL_CONNECTED) {
        WiFi.reconnect();
      }
    }
  }
}
