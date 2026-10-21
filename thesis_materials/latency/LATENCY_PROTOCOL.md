# End-to-End Latency Measurement Protocol

**Goal:** Measure real wall-clock latency from ESP32-CAM motion trigger through backend inference to Flutter UI update (and optional DFPlayer audio).

You cannot invent latency numbers for a thesis. Run this protocol **n ≥ 30** trials and report mean / median / p95.

---

## Latency stages (definitions)

| Symbol | Stage | How measured |
|--------|-------|----------------|
| **T0** | PIR motion accepted / capture enqueued | ESP32 Serial: `Capture enqueued` |
| **T1** | HTTP `/predict` POST starts | ESP32 Serial: upload start log |
| **T2** | Gateway HTTP response received on ESP32 | ESP32 Serial: predict response / HTTP code |
| **T3** | fill-api inference complete (server) | Railway fill-api / backend logs or scripted probe |
| **T4** | `PLAY_AUDIO` command visible to ESP32 | Serial: `BACKEND COMMAND RECEIVED` / `PLAY_AUDIO` |
| **T5** | DFPlayer starts track | Serial: `DFPLAYER PLAY TRACK` |
| **T6** | Flutter shows updated fill | Phone stopwatch / log when `GET /devices/:id/latest` returns new `captured_at` |

**Primary KPIs for thesis:**

1. **Capture → cloud response:** `T2 − T0`  
2. **Capture → audio play:** `T5 − T0` (if audio enabled)  
3. **Capture → Flutter refresh:** `T6 − T0` (poll interval matters)  
4. **Model-only inference:** from Colab (~2.0 ms) or fill-api `/predict` timed locally  

---

## Equipment

- ESP32-CAM with DirectPredict firmware flashed  
- Serial Monitor @ **115200** (Arduino IDE or `scripts/measure_e2e_latency.py` serial mode)  
- Backend + fill-api deployed (Railway)  
- Flutter app on phone (same Wi-Fi / mobile data as field test)  
- Optional: PC script `scripts/probe_predict_latency.py` for API-only timing  

---

## Experiment design

1. Register device with correct `esp32_id` in admin.  
2. Ensure `MODEL_FILL_URL` is set; `AUTO_AUDIO_ON_PREDICT=true` if measuring audio.  
3. Warm up: wait PIR warm-up **60 s** after boot.  
4. For each trial:
   - Note wall clock or use synced laptop clock.  
   - Trigger motion once.  
   - Record T0…T5 from Serial.  
   - On Flutter staff bin detail or public map, pull-to-refresh / wait poll; record T6 when fill updates.  
5. Discard trials with Wi-Fi drops.  
6. Fill `latency_results_template.csv`.

---

## Reporting template (Results chapter)

| Metric | Mean (s) | Median (s) | p95 (s) | n |
|--------|---------:|-----------:|--------:|--:|
| T2−T0 Capture→Predict response | | | | |
| T5−T0 Capture→Audio | | | | |
| T6−T0 Capture→Flutter | | | | |
| fill-api only (PC upload) | | | | |

Discuss: JPEG size (UXGA), Railway region RTT, concurrent models on `/predict`, Flutter poll interval.

---

## Placeholder (until you measure)

Do **not** put fake numbers in the thesis. You may temporarily write:

> End-to-end latency was measured using the protocol in Appendix L (n = N). Model-only inference was 2.0 ms on Colab GPU; field round-trip times are dominated by uplink and multi-model gateway processing.

After measurement, replace with your table.
