import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../db.js';

const __filename  = fileURLToPath(import.meta.url);
const __dirname   = path.dirname(__filename);
const MODEL_PATH  = path.join(__dirname, '..', 'models', 'flood_lstm.onnx');
const SCALER_PATH = path.join(__dirname, '..', 'models', 'scaler_params.json');
const METRICS_PATH = path.join(__dirname, '..', 'models', 'test_metrics.json');

// ── Model test scores (from the notebook's held-out test set) ────────────────
// These are NOT a per-prediction "confidence". They are how well the model scored
// on test data it never saw during training (R² / NSE: 1.0 = perfect, 0 = no skill).
let testMetrics = null;
export function getTestMetrics() {
  if (testMetrics) return testMetrics;
  try {
    const m = JSON.parse(fs.readFileSync(METRICS_PATH, 'utf-8'));
    testMetrics = {
      r2_30m: Number(m.horizon_30m.NSE_R2.toFixed(3)),
      r2_60m: Number(m.horizon_60m.NSE_R2.toFixed(3)),
      mae_30m_m: Number(m.horizon_30m.MAE.toFixed(4)),
      mae_60m_m: Number(m.horizon_60m.MAE.toFixed(4)),
    };
  } catch (_e) {
    testMetrics = { r2_30m: null, r2_60m: null, mae_30m_m: null, mae_60m_m: null };
  }
  return testMetrics;
}

// Which method produced the latest forecast: 'ONNX_LSTM' (the AI model) or
// 'SurgeRate_Fallback' (simple backup formula used if the model can't load).
let lastMethod = null;
export function getModelStatus() {
  const method = lastMethod ?? (cachedSession ? 'ONNX_LSTM' : modelCheckDone ? 'SurgeRate_Fallback' : null);
  return {
    method,
    methodLabel: method === 'ONNX_LSTM' ? 'AI forecast' : method ? 'Simple estimate' : 'Checking…',
    testScores: getTestMetrics(),
  };
}

// Called once at server start so the dashboard knows straight away whether the model loads.
let modelCheckDone = false;
export async function checkModel() {
  const ortModule = await getOrt();
  const session = ortModule ? await getSession(ortModule) : null;
  modelCheckDone = true;
  console.log(session
    ? '[dlService] AI model ready: forecasts use the LSTM (flood_lstm.onnx).'
    : '[dlService] WARNING: AI model could not load — forecasts will use the backup formula.');
  return Boolean(session);
}

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
 * into feature vectors: [water_level_m, surge_velocity]
 *
 * @param {Array<{water_level_m: number}>} chronologicalLogs
 * @returns {Array<{water_level_m: number, surge_velocity: number}>}
 */
export function buildHistoryBuffer(chronologicalLogs) {
  return chronologicalLogs.map((item, i) => {
    const prev = i > 0 ? chronologicalLogs[i - 1] : item;
    // Surge velocity in m/hour for 10-minute physical timesteps (dh / 0.1667 hr = dh * 6.0)
    let rawSurge = (item.water_level_m - prev.water_level_m) * 6.0;
    // Clamp surge_velocity between -2.0 m/h and +3.5 m/h to match scaler_params.json bounds
    const surge_velocity = parseFloat(
      Math.max(-2.0, Math.min(3.5, rawSurge)).toFixed(4)
    );
    return {
      water_level_m: item.water_level_m,
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
export async function getPrediction(historyBuffer, { save = true } = {}) {
  if (!historyBuffer || historyBuffer.length === 0) {
    console.warn('[dlService] getPrediction called with empty historyBuffer.');
    return null;
  }

  // Pad to exactly 6 timesteps (initialize with 0.35m dry baseline for cold-starts)
  const SEQ_LEN = 6;
  const DEFAULT_BASELINE = { water_level_m: 0.35, surge_velocity: 0.0 };
  const padded = Array(SEQ_LEN).fill(null).map((_, i) => {
    const offset = i - (SEQ_LEN - historyBuffer.length);
    return offset >= 0 ? historyBuffer[offset] : DEFAULT_BASELINE;
  });

  const current      = padded[SEQ_LEN - 1];
  const currentLevel = current.water_level_m;

  let predicted30m    = currentLevel;
  let predicted60m    = currentLevel;
  let methodUsed      = 'SurgeRate_Fallback';
  // Stored in ml_projections.confidence_score for compatibility: it is the model's
  // 30-minute TEST score (R² × 100), the same for every forecast — not a live confidence.
  const scores        = getTestMetrics();
  const confidenceScore = scores.r2_30m != null ? Number((scores.r2_30m * 100).toFixed(1)) : null;

  // ── Attempt Live ONNX Inference ───────────────────────────────────────────
  const ortModule = await getOrt();
  if (ortModule) {
    const session = await getSession(ortModule);
    if (session) {
      try {
        const scaler = getScalerParams();
        const sequenceData = new Float32Array(SEQ_LEN * 2);

        // Populate tensor [1, 6, 2] with normalized inputs
        for (let i = 0; i < SEQ_LEN; i++) {
          const rawWL    = padded[i].water_level_m;
          const rawSurge = padded[i].surge_velocity;

          let normWL    = rawWL;
          let normSurge = rawSurge;

          // Apply MinMax scaling if scaler_params.json is loaded
          if (scaler && scaler.min && scaler.range) {
            normWL    = (rawWL    - scaler.min[0]) / scaler.range[0];
            normSurge = (rawSurge - scaler.min[1]) / scaler.range[1];
          }

          sequenceData[i * 2 + 0] = normWL;
          sequenceData[i * 2 + 1] = normSurge;
        }

        const inputName = session.inputNames[0] ?? 'input';
        const tensor    = new ortModule.Tensor('float32', sequenceData, [1, SEQ_LEN, 2]);
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
        methodUsed      = 'ONNX_LSTM';

        console.log(`[dlService] ONNX_LSTM Inference → +30m: ${predicted30m}m  +60m: ${predicted60m}m`);
      } catch (onnxErr) {
        console.error('[dlService] ONNX inference failed (reverting to fallback):', onnxErr.message);
        cachedSession = null; // reset session cache to retry on next call
      }
    }
  }

  // ── Fallback Surge-Rate Math (if ONNX fails or is missing) ─────────────────
  if (methodUsed === 'SurgeRate_Fallback') {
    const avgSurge = current.surge_velocity;

    predicted30m = parseFloat(
      Math.min(3.5, Math.max(0, currentLevel + avgSurge * 0.5 + 0.03)).toFixed(2)
    );
    predicted60m = parseFloat(
      Math.min(3.5, Math.max(0, currentLevel + avgSurge * 1.0 + 0.06)).toFixed(2)
    );
    console.log(`[dlService] SurgeRate_Fallback → +30m: ${predicted30m}m  +60m: ${predicted60m}m`);
  }
  lastMethod = methodUsed;
  const status = getModelStatus();

  // ── Save Projection to Database ───────────────────────────────────────────
  if (!save) {
    return {
      predicted30m, predicted60m, confidenceScore, methodUsed,
      horizon_30m_m: predicted30m, horizon_60m_m: predicted60m, confidence_score: confidenceScore,
      methodLabel: status.methodLabel, testScores: status.testScores,
    };
  }
  try {
    const projection = await prisma.mLProjection.create({
      data: {
        horizon30mM:     predicted30m,
        horizon60mM:     predicted60m,
        confidenceScore: confidenceScore,
      },
    });
    console.log(`[dlService] Saved MLProjection (id: ${projection.id}) [${methodUsed}]`);
    return {
      ...projection,
      timestamp: projection.generatedAt,
      horizon_30m_m: predicted30m,
      horizon_60m_m: predicted60m,
      confidence_score: confidenceScore,
      predicted30m,
      predicted60m,
      confidenceScore,
      methodUsed,
      methodLabel: status.methodLabel,
      testScores: status.testScores,
    };
  } catch (dbErr) {
    console.error('[dlService] Failed to save MLProjection:', dbErr.message);
    return {
      predicted30m, predicted60m, confidenceScore, methodUsed,
      horizon_30m_m: predicted30m, horizon_60m_m: predicted60m, confidence_score: confidenceScore,
      methodLabel: status.methodLabel, testScores: status.testScores,
    };
  }
}

// ── DB-backed Inference Helper ───────────────────────────────────────────────
// nodeId: forecast for one board only (its own last 6 readings)
export async function runPredictionInference(nodeId = null, { save = true } = {}) {
  try {
    const logs = await prisma.telemetryLog.findMany({
      where: nodeId ? { nodeId } : {},
      orderBy: { recordedAt: 'desc' },
      take: 6,
    });

    if (logs.length === 0) {
      console.log('[dlService] No telemetry logs available for inference.');
      return null;
    }

    const chronological = [...logs].map(l => ({
      water_level_m: l.waterLevelM,
    })).reverse();
    const historyBuffer = buildHistoryBuffer(chronological);
    return await getPrediction(historyBuffer, { save });
  } catch (err) {
    console.error('[dlService] runPredictionInference error:', err.message);
    return null;
  }
}
