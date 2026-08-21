import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../db.js';

const __filename  = fileURLToPath(import.meta.url);
const __dirname   = path.dirname(__filename);
const MODEL_PATH  = path.join(__dirname, '..', 'models', 'flood_lstm.onnx');
const SCALER_PATH = path.join(__dirname, '..', 'models', 'scaler_params.json');

// ── Scaler Parameters Loader ─────────────────────────────────────────────────
let scalerParams = null;
function getScalerParams() {
  if (scalerParams) return scalerParams;
  if (fs.existsSync(SCALER_PATH)) {
    try {
      const raw = fs.readFileSync(SCALER_PATH, 'utf-8');
      scalerParams = JSON.parse(raw);
      console.log('[dlService] Loaded MinMax scaler parameters from scaler_params.json');
    } catch (err) {
      console.error('[dlService] Failed to load scaler_params.json:', err.message);
    }
  }
  return scalerParams;
}

// ── ONNX Runtime Lazy Loader ─────────────────────────────────────────────────
let ort = null;
async function getOrt() {
  if (!ort) {
    try {
      ort = await import('onnxruntime-node');
    } catch (e) {
      console.warn('[dlService] onnxruntime-node dynamic import failed:', e.message);
    }
  }
  return ort;
}

// ── ONNX Session Cache ───────────────────────────────────────────────────────
let cachedSession = null;
async function getSession(ortModule) {
  if (cachedSession) return cachedSession;
  if (!fs.existsSync(MODEL_PATH)) return null;
  try {
    cachedSession = await ortModule.InferenceSession.create(MODEL_PATH);
    console.log('[dlService] ONNX session loaded successfully from flood_lstm.onnx');
  } catch (err) {
    console.error('[dlService] Failed to load ONNX session from flood_lstm.onnx:', err.message);
    cachedSession = null;
  }
  return cachedSession;
}

// ── History Buffer Builder ───────────────────────────────────────────────────
/**
 * Converts an array of TelemetryLog records (chronological, oldest-first)
 * into feature vectors: [water_level_m, rainfall_rate, surge_velocity]
 *
 * @param {Array<{water_level_m: number, rainfall_rate: number}>} chronologicalLogs
 * @returns {Array<{water_level_m: number, rainfall_rate: number, surge_velocity: number}>}
 */
export function buildHistoryBuffer(chronologicalLogs) {
  return chronologicalLogs.map((item, i) => {
    const prev = i > 0 ? chronologicalLogs[i - 1] : item;
    // Approximate surge velocity in m/hour between consecutive readings
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

// ── Core Inference Function ───────────────────────────────────────────────────
/**
 * Run ONNX LSTM inference (with MinMax normalization/denormalization via scaler_params.json)
 * or fallback surge-rate calculation from a sliding-window history buffer.
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

  // Pad to exactly 6 timesteps (repeat earliest entry if sequence is shorter)
  const SEQ_LEN = 6;
  const padded = Array(SEQ_LEN).fill(historyBuffer[0]).map((base, i) => {
    const offset = i - (SEQ_LEN - historyBuffer.length);
    return offset >= 0 ? historyBuffer[offset] : base;
  });

  const current      = padded[SEQ_LEN - 1];
  const currentLevel = current.water_level_m;

  let predicted30m    = currentLevel;
  let predicted60m    = currentLevel;
  let confidenceScore = 94.0;
  let methodUsed      = 'SurgeRate_Fallback';

  // ── Attempt Live ONNX Inference ───────────────────────────────────────────
  const ortModule = await getOrt();
  if (ortModule) {
    const session = await getSession(ortModule);
    if (session) {
      try {
        const scaler = getScalerParams();
        const sequenceData = new Float32Array(SEQ_LEN * 3);

        // Populate tensor [1, 6, 3] with normalized inputs
        for (let i = 0; i < SEQ_LEN; i++) {
          const rawWL    = padded[i].water_level_m;
          const rawRain  = padded[i].rainfall_rate;
          const rawSurge = padded[i].surge_velocity;

          let normWL    = rawWL;
          let normRain  = rawRain;
          let normSurge = rawSurge;

          // Apply MinMax scaling if scaler_params.json is loaded
          if (scaler && scaler.min && scaler.range) {
            normWL    = (rawWL    - scaler.min[0]) / scaler.range[0];
            normRain  = (rawRain  - scaler.min[1]) / scaler.range[1];
            normSurge = (rawSurge - scaler.min[2]) / scaler.range[2];
          }

          sequenceData[i * 3 + 0] = normWL;
          sequenceData[i * 3 + 1] = normRain;
          sequenceData[i * 3 + 2] = normSurge;
        }

        const inputName = session.inputNames[0] ?? 'input';
        const tensor    = new ortModule.Tensor('float32', sequenceData, [1, SEQ_LEN, 3]);
        const results   = await session.run({ [inputName]: tensor });
        const output    = results[session.outputNames[0] ?? 'output'].data;

        const raw30m = output[0];
        const raw60m = output[1] ?? (output[0] + 0.02);

        // Denormalize output targets back to real-world meters
        if (scaler && scaler.min && scaler.range) {
          predicted30m = raw30m * scaler.range[0] + scaler.min[0];
          predicted60m = raw60m * scaler.range[0] + scaler.min[0];
        } else {
          predicted30m = raw30m;
          predicted60m = raw60m;
        }

        // Clamp to physically realistic bounds [0.0m, 3.5m]
        predicted30m    = parseFloat(Math.min(3.5, Math.max(0, predicted30m)).toFixed(2));
        predicted60m    = parseFloat(Math.min(3.5, Math.max(0, predicted60m)).toFixed(2));
        confidenceScore = 96.5;
        methodUsed      = 'ONNX_LSTM';

        console.log(`[dlService] ONNX_LSTM Inference → +30m: ${predicted30m}m  +60m: ${predicted60m}m (Confidence: ${confidenceScore}%)`);
      } catch (onnxErr) {
        console.error('[dlService] ONNX inference failed (reverting to fallback):', onnxErr.message);
        cachedSession = null; // reset session cache to retry on next call
      }
    }
  }

  // ── Fallback Surge-Rate Math (if ONNX fails or is missing) ─────────────────
  if (methodUsed === 'SurgeRate_Fallback') {
    const avgSurge  = current.surge_velocity;
    const rainBoost = current.rainfall_rate > 10 ? 0.08 : 0.03;

    predicted30m = parseFloat(
      Math.min(3.5, Math.max(0, currentLevel + avgSurge * 0.5 + rainBoost)).toFixed(2)
    );
    predicted60m = parseFloat(
      Math.min(3.5, Math.max(0, currentLevel + avgSurge * 1.0 + rainBoost * 2)).toFixed(2)
    );
    confidenceScore = 94.0;
    console.log(`[dlService] SurgeRate_Fallback → +30m: ${predicted30m}m  +60m: ${predicted60m}m`);
  }

  // ── Save Projection to Database ───────────────────────────────────────────
  try {
    const projection = await prisma.mLProjection.create({
      data: {
        horizon_30m_m:    predicted30m,
        horizon_60m_m:    predicted60m,
        confidence_score: confidenceScore,
      },
    });
    console.log(`[dlService] Saved MLProjection (id: ${projection.id}) [${methodUsed}]`);
    return { ...projection, predicted30m, predicted60m, confidenceScore, methodUsed };
  } catch (dbErr) {
    console.error('[dlService] Failed to save MLProjection:', dbErr.message);
    return { predicted30m, predicted60m, confidenceScore, methodUsed };
  }
}

// ── DB-backed Inference Helper ───────────────────────────────────────────────
export async function runPredictionInference() {
  try {
    const logs = await prisma.telemetryLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 6,
    });

    if (logs.length === 0) {
      console.log('[dlService] No telemetry logs available for inference.');
      return null;
    }

    const chronological = [...logs].reverse();
    const historyBuffer = buildHistoryBuffer(chronological);
    return await getPrediction(historyBuffer);
  } catch (err) {
    console.error('[dlService] runPredictionInference error:', err.message);
    return null;
  }
}
