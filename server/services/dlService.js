import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODEL_PATH = path.join(__dirname, '..', 'models', 'flood_lstm.onnx');

// ── ONNX Runtime lazy-load ───────────────────────────────────────────────────
let ort = null;
async function getOrt() {
  if (!ort) {
    try {
      ort = await import('onnxruntime-node');
    } catch (e) {
      console.warn('[dlService] onnxruntime-node not available:', e.message);
    }
  }
  return ort;
}

// ── ONNX Session cache (load once, reuse across every POST /telemetry) ───────
let cachedSession = null;
async function getSession(ortModule) {
  if (cachedSession) return cachedSession;
  if (!fs.existsSync(MODEL_PATH)) return null;
  try {
    cachedSession = await ortModule.InferenceSession.create(MODEL_PATH);
    console.log('[dlService] ONNX session loaded and cached from flood_lstm.onnx');
  } catch (err) {
    console.error('[dlService] Failed to load ONNX session:', err.message);
    cachedSession = null;
  }
  return cachedSession;
}

// ── History buffer builder ───────────────────────────────────────────────────
/**
 * Converts an array of TelemetryLog records (chronological, oldest-first)
 * into the 3-feature sliding-window format required by the LSTM input tensor.
 *
 * Feature vector per timestep: [water_level_m, rainfall_rate, surge_velocity]
 *   surge_velocity = change in water level per hour between consecutive readings.
 *
 * @param {Array<{water_level_m: number, rainfall_rate: number}>} chronologicalLogs
 * @returns {Array<{water_level_m: number, rainfall_rate: number, surge_velocity: number}>}
 */
export function buildHistoryBuffer(chronologicalLogs) {
  return chronologicalLogs.map((item, i) => {
    const prev = i > 0 ? chronologicalLogs[i - 1] : item;
    // Approximate surge velocity in m/hour (assuming ~15 min between readings)
    const surge_velocity = parseFloat(
      ((item.water_level_m - prev.water_level_m) * 4).toFixed(4)
    );
    return {
      water_level_m: item.water_level_m,
      rainfall_rate:  item.rainfall_rate,
      surge_velocity,
    };
  });
}

// ── Core inference function (used by POST /telemetry pipeline) ───────────────
/**
 * Run ONNX LSTM (or surge-rate fallback) inference from a pre-built history buffer.
 * Does NOT query the database — caller provides the buffer. Saves result to MLProjection.
 *
 * @param {Array<{water_level_m: number, rainfall_rate: number, surge_velocity: number}>} historyBuffer
 *   1–6 entries, chronological (oldest first). Automatically padded to 6 if shorter.
 * @returns {Promise<{predicted30m, predicted60m, confidenceScore, methodUsed} | null>}
 */
export async function getPrediction(historyBuffer) {
  if (!historyBuffer || historyBuffer.length === 0) {
    console.warn('[dlService] getPrediction called with empty historyBuffer.');
    return null;
  }

  // Pad to exactly 6 timesteps (repeat first entry for early readings)
  const SEQ_LEN = 6;
  const padded = Array(SEQ_LEN).fill(historyBuffer[0]).map((base, i) => {
    const offset = i - (SEQ_LEN - historyBuffer.length);
    return offset >= 0 ? historyBuffer[offset] : base;
  });

  const current = padded[SEQ_LEN - 1];
  const currentLevel = current.water_level_m;

  let predicted30m    = currentLevel;
  let predicted60m    = currentLevel;
  let confidenceScore = 94.0;
  let methodUsed      = 'SurgeRate_Fallback';

  // ── Attempt ONNX inference ─────────────────────────────────────────────────
  const ortModule = await getOrt();
  if (ortModule) {
    const session = await getSession(ortModule);
    if (session) {
      try {
        // Build Float32Array [1, 6, 3] — batch=1, seq=6, features=3
        const sequenceData = new Float32Array(SEQ_LEN * 3);
        for (let i = 0; i < SEQ_LEN; i++) {
          sequenceData[i * 3 + 0] = padded[i].water_level_m;
          sequenceData[i * 3 + 1] = padded[i].rainfall_rate;
          sequenceData[i * 3 + 2] = padded[i].surge_velocity;
        }

        const inputName = session.inputNames[0] ?? 'input';
        const tensor    = new ortModule.Tensor('float32', sequenceData, [1, SEQ_LEN, 3]);
        const results   = await session.run({ [inputName]: tensor });
        const out       = results[session.outputNames[0] ?? 'output'].data;

        predicted30m    = parseFloat(Math.min(1.8, Math.max(0, out[0])).toFixed(2));
        predicted60m    = parseFloat(Math.min(1.8, Math.max(0, out[1] ?? out[0] + 0.05)).toFixed(2));
        confidenceScore = 96.5;
        methodUsed      = 'ONNX_LSTM';

        console.log(`[dlService] ONNX -> +30m: ${predicted30m}m  +60m: ${predicted60m}m`);
      } catch (onnxErr) {
        console.error('[dlService] ONNX inference error (falling back):', onnxErr.message);
        // Invalidate cached session so next call retries load
        cachedSession = null;
      }
    }
  }

  // ── Surge-rate fallback ────────────────────────────────────────────────────
  if (methodUsed === 'SurgeRate_Fallback') {
    const avgSurge  = current.surge_velocity;                    // m/h
    const rainBoost = current.rainfall_rate > 10 ? 0.08 : 0.03; // non-linear rain correction

    predicted30m = parseFloat(
      Math.min(1.8, Math.max(0, currentLevel + avgSurge * 0.5 + rainBoost)).toFixed(2)
    );
    predicted60m = parseFloat(
      Math.min(1.8, Math.max(0, currentLevel + avgSurge * 1.0 + rainBoost * 2)).toFixed(2)
    );
    confidenceScore = 94.0;
    console.log(`[dlService] Fallback surge-rate -> +30m: ${predicted30m}m  +60m: ${predicted60m}m`);
  }

  // ── Persist to MLProjection ────────────────────────────────────────────────
  try {
    const projection = await prisma.mLProjection.create({
      data: {
        horizon_30m_m:    predicted30m,
        horizon_60m_m:    predicted60m,
        confidence_score: confidenceScore,
      },
    });
    console.log(`[dlService] MLProjection saved (id:${projection.id}) [${methodUsed}]`);
    return { ...projection, predicted30m, predicted60m, confidenceScore, methodUsed };
  } catch (dbErr) {
    console.error('[dlService] Failed to persist MLProjection:', dbErr.message);
    // Still return the prediction even if DB write failed
    return { predicted30m, predicted60m, confidenceScore, methodUsed };
  }
}

// ── DB-backed inference (used by GET /api/v1/telemetry/projection) ───────────
/**
 * Queries the last 6 TelemetryLog records from the database and runs inference.
 * Use this only for the projection REST endpoint — not the hot POST path.
 *
 * @returns {Promise<object|null>}
 */
export async function runPredictionInference() {
  try {
    const logs = await prisma.telemetryLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 6,
    });

    if (logs.length === 0) {
      console.log('[dlService] No telemetry records available for DB-backed inference.');
      return null;
    }

    const chronological  = [...logs].reverse();
    const historyBuffer  = buildHistoryBuffer(chronological);
    return await getPrediction(historyBuffer);
  } catch (err) {
    console.error('[dlService] runPredictionInference error:', err.message);
    return null;
  }
}
