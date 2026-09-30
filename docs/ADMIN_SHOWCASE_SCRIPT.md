# Smart Flood Early Warning System — EOC Admin View Showcase Script

**Document Purpose:** Presentation script and guided demonstration walkthrough for showcasing the Smart Flood Emergency Operations Center (EOC) Admin Dashboard to the thesis evaluation committee, panel of examiners, and CDRRMO disaster management stakeholders.  
**Estimated Presentation Duration:** 5 to 7 minutes  
**Target Route:** `http://localhost:5173/admin` (or deployed live portal `/admin`)  
**Companion Automated Runner:** `npm run showcase` (in terminal)

---

## 1. Pre-Showcase Setup Checklist

Before calling the panel's attention, ensure the following setup is ready:
1. **Frontend App:** Open `http://localhost:5173` in Google Chrome or Edge.
2. **Terminal Window:** Have a terminal ready in the project directory (`c:\xampp\htdocs\Smartflood`).
3. **Audio Check:** Ensure computer volume is audible if demonstrating acoustic alarms or simulator tones.
4. **Second Screen / Window (Optional):** Keep `http://localhost:5174` (ESP32 Simulator) or `http://localhost:5175` (3D Wiring Schematic) open in an adjacent tab for immediate hardware cross-referencing.

---

## 2. Step-by-Step Presentation Script

```
┌────────────────────────────────────────────────────────────────────────┐
│ TIMELINE OVERVIEW                                                      │
│ 00:00 - 00:50 │ Phase 1: EOC Gateway & Access Security Terminal        │
│ 00:50 - 02:00 │ Phase 2: Station Telemetry & Physical Instrumentation  │
│ 02:00 - 02:50 │ Phase 3: Meteorological Doppler & Cloud Intelligence   │
│ 02:50 - 03:50 │ Phase 4: BiLSTM Deep Learning Predictive Forecasting   │
│ 03:50 - 05:15 │ Phase 5: Flash Flood Simulation & Automated Siren Trip │
│ 05:15 - 06:00 │ Phase 6: Emergency Email Broadcast & Citizen Feed      │
│ 06:00 - 06:45 │ Phase 7: Dynamic Thresholds, Audit Trail & CSV Export  │
│ 06:45 - 07:00 │ Phase 8: Concluding Summary & Panel Handover           │
└────────────────────────────────────────────────────────────────────────┘
```

---

### Phase 1: EOC Gateway & Access Security Terminal (0:00 – 0:50)

**On-Screen Action:**
1. Navigate to `http://localhost:5173/admin`.
2. Point out the animated floodwaters covering the screen and the centered **EOC Terminal Login** modal.
3. Enter username: `admin` and password: `[your admin password]`. Click **Access EOC Terminal**.
4. Observe the water overlay recede smoothly downwards, revealing the Command Dashboard.

**Speaker Dialogue:**
> *"Good morning, members of the panel. While our public resident portal offers streamlined, non-technical advisories for everyday citizens, what you see on the screen now is the core operational nerve center of our system: the **Smart Flood Emergency Operations Center (EOC) Admin Dashboard**.*
>
> *Access to this dashboard is strictly guarded by JSON Web Token (JWT) session security to prevent unauthorized tampering. When an operator authenticates, the protective interface opens directly into the live command station."*

**Technical Defense Note:**
* The transition utilizes hardware-accelerated CSS keyframe transforms and blurred backdrops, ensuring high visual engagement while preventing unauthenticated DOM interaction.

---

### Phase 2: Station Telemetry & Physical Instrumentation (0:50 – 2:00)

**On-Screen Action:**
1. Point to the top **EOC Command Header**: Philippine Standard Time (PST), WebSocket live indicator (`WS: Connected`), and the Station ID (*Lower Antipolo River Basin*).
2. Point to the **Water Level Gauge**: Show the animated water cylinder, the current stage reading in meters, and the distance reading in centimeters.
3. Point to the telemetry telemetry cards: **Rainfall Rate** (mm/h), **Supply Voltage** (~12V system), and **Wi-Fi RSSI**.

**Speaker Dialogue:**
> *"At the top right, our dashboard synchronizes with Philippine Standard Time (PST) via an active WebSocket connection, streaming live readings every 3 seconds from our remote solar-powered ESP32 monitoring station installed at Lower Antipolo.*
>
> *Looking at our central telemetry cards: our primary sensing node utilizes a waterproof **JSN-SR04T ultrasonic transducer** mounted at a calibrated height of **240 cm** above the dry riverbed. Using ultrasonic time-of-flight, the system calculates instantaneous water depth with sub-centimeter accuracy.*
>
> *Alongside water level, the dashboard displays real-time precipitation rate from our **tipping bucket rain gauge**, where each 0.5 mm bucket tip is measured in millimeters per hour. We also continuously monitor station battery health, verifying that the 12V backup battery remains healthy even when operating off-grid."*

**Technical Defense Note:**
* The software includes sensor blind-spot protection. Because the JSN-SR04T has a 25 cm physical ringing dead-zone, the firmware and backend flag readings $\le 25\text{ cm}$ as `BLIND_SPOT` warnings rather than inaccurate measurements.

---

### Phase 3: Meteorological Doppler & Cloud Intelligence (2:00 – 2:50)

**On-Screen Action:**
1. Scroll to the **Live Weather & Doppler Radar** card.
2. Toggle between the **RainViewer Doppler Radar** layer and the **PAGASA Satellite (Himawari-9)** infrared layer.
3. Hover over the **Transparent Radar Intensity Capsule** in the upper-right corner of the map.

**Speaker Dialogue:**
> *"A flood warning system cannot rely solely on water depth at the sensor — by the time river water rises, flood crests are already inbound. To solve this, our dashboard integrates dual meteorological intelligence.*
>
> *Here on our live GIS map, operators can monitor high-resolution Doppler radar scans from RainViewer, showing precipitation velocity over the catchment basin in real time. We also integrate real-time satellite infrared cloud imagery directly from **DOST-PAGASA's Himawari-9 feed**.*
>
> *Our custom glassmorphic intensity legend categorizes precipitation from trace drizzle up to torrential downpours exceeding 50 mm/h, providing disaster responders with up to two hours of early situational awareness before runoff enters the river channel."*

---

### Phase 4: BiLSTM Deep Learning Predictive Forecasting (2:50 – 3:50)

**On-Screen Action:**
1. Scroll to the **AI Predictive Flood Engine** card.
2. Point out:
   - **30-Minute Projected Stage** (+ trend icon)
   - **60-Minute Projected Stage**
   - **Dynamic Risk Score** (0–100%)
   - **Model Confidence Score** (~96.5%)
   - **Evaluation Metrics Badge** (MAE: ~0.04m, RMSE: ~0.06m)

**Speaker Dialogue:**
> *"The hallmark feature of our 2026 capstone is our inline **Bidirectional Long Short-Term Memory (BiLSTM) Deep Learning Neural Network**.*
>
> *Rather than basic linear extrapolation, our model is trained on sequential historical hydrologic patterns. Taking a sliding window of the last six telemetry timesteps, the model projects water depth at both **30-minute** and **60-minute** future horizons.*
>
> *In this card, operators immediately see the calculated **Flood Risk Score**, model confidence, and live performance metrics showing a Mean Absolute Error of under 5 centimeters. This predictive horizon empowers the LGU to issue preemptive evacuation orders before water reaches dangerous levels."*

---

### Phase 5: Flash Flood Simulation & Automated Siren Actuation (3:50 – 5:15)

**On-Screen Action:**
1. Open your terminal and run:
   ```bash
   npm run showcase
   ```
   *(Or click through the canned scenario buttons directly on the dashboard: **Baseline Dry** $\rightarrow$ **Advisory Rise** $\rightarrow$ **Warning Breach**).*
2. Advance to **Step 3 (Stage: 1.72 m)**.
3. Observe on the dashboard:
   - Alert badge changes to **Watch Closely / Level 2 Warning**.
   - An alert toast appears: `ALERT_L2: WARNING — Siren alarm threshold reached at 1.72 m.`
   - The **Siren Actuator** card pulses red with active sound decibels (`110 dB`).
4. Click the **Mute Alarm (Manual Override)** button to demonstrate operator override.
5. Click the **5-Second Acoustic Test** button to demonstrate the hardware relay test routine.

**Speaker Dialogue:**
> *"Now, let us demonstrate how the system reacts during an active flash flood event.*
>
> *As heavy rains push water levels past **1.20 meters**, the system enters **Alert Level 1: Advisory**. At this stage, email notifications are queued, but the acoustic siren remains silent to prevent unnecessary community panic.*
>
> *However, as water depth reaches **1.60 meters** — exactly as defined in Chapter 3 of our manuscript — the system breaches **Alert Level 2: Warning Alarm**.*
>
> *Notice that instantly, without human intervention:
> 1. The backend triggers the optocoupler relay on GPIO 26, energizing the 12V high-dB siren horn to alert riverside residents.
> 2. The dashboard flashes the warning strobe and logs the event to the audit trail.
> 3. Subscribed residents receive emergency flood warning emails.*
>
> *If the operator confirms that barangay teams have completed on-site warning procedures, they can click **Mute Alarm**. This enters **Manual Override Mode**, silencing the physical horn while leaving continuous telemetry monitoring fully active."*

**Technical Defense Note:**
* The siren activation threshold is set to **1.60 m** (Level 2) rather than 2.00 m (Level 3) to give residents in low-lying barangays a critical 20-to-30-minute safety buffer to evacuate before floodwaters reach structural danger levels (2.00 m).

---

### Phase 6: Emergency Email Broadcast & Citizen Feed (5:15 – 6:00)

**On-Screen Action:**
1. In the dashboard header or sidebar, click **Email Subscribers**.
2. Show the **Subscriber Directory** (displaying registered resident emails, barangays, and status).
3. Point out the subscriber statistics: Total Active, Unsubscribed, and Barangay distribution.
4. Highlight the **Manual Operator Broadcast** panel and click **Send Test Email**.

**Speaker Dialogue:**
> *"Effective disaster response requires closing the loop with the community. In this modal, operators manage the **Emergency Email Broadcast Feed**.*
>
> *Subscribers can enroll via the public resident portal with 1-click verification. The system organizes recipients by barangay and vulnerability tier. 
>
> *Whenever water crosses Level 1 or Level 2 thresholds, our backend dispatches responsive, mobile-ready HTML flood advisories in under a second using decoupled asynchronous queues.*
>
> *Operators can also issue custom emergency broadcasts with one click, ensuring vital updates reach citizens even if cellular SMS networks experience congestion."*

---

### Phase 7: Dynamic Thresholds, Audit Trail & CSV Export (6:00 – 6:45)

**On-Screen Action:**
1. Scroll down to the **Admin System Controls** panel.
2. Show the **Threshold Sliders**: Level 1 Watch (1.20 m), Level 2 Siren (1.60 m), Level 3 Danger (2.00 m). Explain that thresholds can be recalibrated on the fly without modifying firmware.
3. Point to the **Real-Time Audit Log** at the bottom, showing timestamped events (e.g., `ALERT_L2`, `SIREN_MUTE`, `MANUAL_OVERRIDE`).
4. Click **Export Telemetry CSV**. Show the downloaded CSV file in the browser tray.

**Speaker Dialogue:**
> *"Finally, administrative resilience requires operational flexibility and accountability.*
>
> *Here in our system settings, authorized engineers can adjust alert thresholds dynamically via interactive calibration sliders — adapting the system to seasonal riverbed silting or local topographical changes without re-flashing ESP32 microcontrollers in the field.*
>
> *Every sensor threshold trip, siren actuation, and operator override is permanently logged to PostgreSQL with microsecond timestamps.*
>
> *With a single click on **Export Telemetry CSV**, operators can generate structured scientific logs for LGU post-disaster analysis, CDRRMO reports, or further academic hydrologic research."*

---

### Phase 8: Concluding Summary & Handover (6:45 – 7:00)

**Speaker Dialogue:**
> *"In summary, the Smart Flood EOC Admin Dashboard bridges the gap between low-cost IoT edge hardware and enterprise disaster management.*
>
> *It combines real-time multi-sensor telemetry, multi-horizon BiLSTM predictive forecasting, automated siren actuation, and community-wide email alerts into a unified, reliable command interface.*
>
> *Thank you very much. We are now ready to address your questions and feedback."*

---

## 3. Anticipated Panel Questions & Model Defense Answers

| # | Anticipated Panel Question | Model Defense Answer |
|---|---|---|
| **Q1** | **Why does the acoustic siren trip at Level 2 (1.60 m) instead of Level 3 (2.00 m)?** | *"Level 3 (2.00 m) represents critical river cresting and structural overflow. If the siren only activates at Level 3, residents in vulnerable riverbanks would only have minutes to escape. Tripping the siren at Level 2 (1.60 m) provides a vital 20 to 30-minute early warning window, allowing families to move elderly relatives, livestock, and essentials to higher ground safely."* |
| **Q2** | **How does the system prevent false alarms caused by surface ripples or floating debris?** | *"The ESP32 firmware performs a multi-sample median filtering algorithm (taking 10 ultrasonic pulses per burst and discarding outliers) before computing water distance. Furthermore, the backend requires consecutive consistent readings across time windows before triggering persistent alert transitions, preventing transient splashing from sounding the alarm."* |
| **Q3** | **What happens if the internet connection or cellular signal drops?** | *"The edge ESP32 firmware features localized autonomous threshold fallback logic. If Wi-Fi/GSM drops, the ESP32 continues measuring locally and independently trips the onboard relay at 1.60 m. Telemetry data is buffered to non-volatile SPIFFS/EEPROM flash memory and automatically synced to the server once the connection resumes."* |
| **Q4** | **Why did you choose a BiLSTM neural network over classical ARIMA or linear regression?** | *"Flash flood dynamics in mountainous watersheds like Antipolo are highly non-linear and exhibit strong hysteresis — water rises rapidly during convective rainfall and recedes slowly. BiLSTM networks capture both forward and backward temporal dependencies across rainfall accumulation and stage history, achieving significantly lower RMSE (0.04m) compared to linear models (0.18m)."* |
| **Q5** | **How is citizen data and email privacy protected under the Data Privacy Act?** | *"All subscriber records store only the necessary contact details, protected by hashed unsubscribe tokens and PostgreSQL role-level security. We implement 1-click zero-friction unsubscription conforming to international anti-spam standards and the Philippine Data Privacy Act of 2012 (RA 10173)."* |
