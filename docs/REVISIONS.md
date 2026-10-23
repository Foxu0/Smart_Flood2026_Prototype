# Smart Flood: Panel Revisions Checklist

Post-defense revisions for the final defense (November 2026).
✅ done · 🔄 in progress · ⬜ to do

## System (web)

| # | Revision | Status | Notes |
|---|---|---|---|
| 1 | Roles: Super Admin, CDRRMO, Barangay; residents stay anonymous | ✅ | `shared/roles.js` |
| 2 | Admin menu (Dashboard, Hardware, Alerts, Reports, Users) | ✅ | |
| 3 | Hardware management: add, swap, turn on/off | ✅ | Boards assigned by sticker **board code** |
| 4 | Per-board alert thresholds (Level 1 / 2 / 3 = spill) | ✅ | Hardware → Edit |
| 5 | Alerts: SMS + email, organized by barangay | ✅ | SMS is simulated until `SEMAPHORE_API_KEY` is set |
| 6 | Alerts only go to the alerting board's barangay | ✅ | |
| 7 | Reports: CSV downloads + activity log | ✅ | |
| 8 | CDRRMO dashboard: water level + forecast per barangay station | ✅ | |
| 9 | Resident page: choose your barangay; sign up for SMS/email | ✅ | Only barangays with a station |
| 10 | Heat map (replace PAGASA/RainViewer) | ✅ | Flood map of Antipolo: a glow per station coloured by its live level; on the resident page and both dashboards. New stations: tap **Use my location** in Add board while standing at the site (phone GPS). **Existing 4 stations still use barangay placeholders**: open Edit at each site and tap it |

## Hardware

| # | Revision | Status | Notes |
|---|---|---|---|
| 11 | Water current speed sensor (HB100 radar, GPIO 4) | ⬜ | Hardware work postponed |
| 12 | Firmware: send the board code (`X-Device-Key`) | ⬜ | `npm run board:new-code` per board; then set `REQUIRE_DEVICE_KEY=true` |
| 13 | Firmware: correct divider values (10k/22k echo, 100k/22k battery) | ⬜ | Repo firmware still has old values |
| 14 | Multiple probes per area (upstream/downstream) | ⬜ | Later. Plan: upstream early warning using water speed × distance, plus a sensor disagreement check |

## AI forecast (LSTM)

| # | Revision | Status | Notes |
|---|---|---|---|
| 15 | **Fix input spacing:** feed the model six **10-minute averages** of the last hour (as trained), not the last 6 raw readings | ✅ | Also: no made-up 0.35 m padding; backup formula no longer adds a built-in rise |
| 16 | **Baseline comparison:** LSTM vs persistence vs simple formula on the same test events | ✅ | Flood events, 30/60 min error: LSTM **1.33 / 1.98 cm**, simple formula 3.46 / 6.67 cm, persistence 4.03 / 7.61 cm. `server/models/compare_baselines.py` |
| 17 | **Forecast accuracy report:** compare each saved 30/60-min forecast with the actual reading later (CSV) | ⬜ | Real-data validation once the sensor is installed |
| 18 | Retrain with real readings from all stations | ⬜ | Future work; needs weeks of data incl. rain events. Add water speed as a 3rd input then (speed is already saved with every reading) |
| 18a | **Fair test split:** old split put only calm/minor days in the test set (no floods); now each event goes whole into train/val/test, per event type | ✅ | Model retrained Oct 22, 2026 |

## Manuscript

| # | Revision | Status | Notes |
|---|---|---|---|
| 19 | **Why LSTM (RRL):** Hochreiter & Schmidhuber (1997); Kratzert et al. (2018); Le et al. (2019); Vizi et al. (2023); Nearing et al. (2024) | ⬜ | Paragraphs + APA references prepared. Confirm the Le et al. article number (1387) and the Nearing et al. author list |
| 20 | Local study to cite and answer: De Lara-Tuprio et al. (2024), Marikina/Sto. Niño, Random Forest beat ANN/SVM (no LSTM tested) | ⬜ | Answer: different inputs (multi-station rainfall); ours is a single-station sequence |
| 21 | Limitation: model trained on **simulated** hydrographs; single-site training (Kratzert et al., 2024) | ⬜ | Future work: retrain on real multi-station data |
| 22 | Update AI scores in the manuscript: replace 0.826 / 0.629 with the new results | ⬜ | All test events: MAE **1.25 / 1.81 cm**, R² **0.996 / 0.990**. Flood events: MAE 1.33 / 1.98 cm. Add the baseline table and both figures; explain the old split was fixed. Known behaviour: slightly overshoots moderate-flood peaks, undershoots the sharpest flash-flood peak |
| 23 | Level 2 threshold: live default is **1.45 m**; manuscript says **1.60 m** | ⬜ | Pick one and make both match |
| 24 | Objectives RRL: QA testing (ISO/IEC/IEEE 29119-1:2022), ISO/IEC 25010:2023, TAM | ⬜ | Prepared; switch the evaluation tool to the **9** characteristics of the 2023 version |
| 25 | Board connection (sticker code) explained in Chapter 3 | ⬜ | "Each board has a unique code, like a Wi-Fi password…" |
| 26 | CDRRMO data request letter (flood records, first-flooded areas, causes) | ⬜ | Letter drafted; send before the visit |
