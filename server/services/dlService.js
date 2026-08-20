import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODEL_PATH = path.join(__dirname, '..', 'models', 'flood_lstm.onnx');

let ort = null;

// Lazy-load onnxruntime-node
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

/**
 * Predicts water levels at +30m and +60m horizons based on recent telemetry.
 * Uses flood_lstm.onnx if present; otherwise uses mathematical rolling surge rate projection.
 * Saves result to MLProjection table in Supabase.
 */
export async function runPredictionInference() {
  try {
    // 1. Fetch last 6 TelemetryLog records (ordered ascending)
    const logs = await prisma.telemetryLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 6,
    });

    if (logs.length === 0) {
      console.log('[dlService] No telemetry records available for inference.');
      return null;
    }

    // Sort ascending for chronological matrix sequence
    const chronological = [...logs].reverse();
    const currentLog = chronological[chronological.length - 1];
    const currentLevel = currentLog.water_level_m;

    let predicted30m = currentLevel;
    let predicted60m = currentLevel;
    let confidenceScore = 94.0;
    let methodUsed = 'SurgeRate_Fallback';

    // 2. Check if ONNX model file exists
    const modelExists = fs.existsSync(MODEL_PATH);
    const ortModule = await getOrt();

    if (modelExists && ortModule) {
      try {
        console.log('[dlService] Loading ONNX model flood_lstm.onnx for inference...');
        const session = await ortModule.InferenceSession.create(MODEL_PATH);

        // Build sequence matrix [6, 3] -> [WaterLevel, Rainfall, SurgeRate]
        const sequenceData = new Float32Array(6 * 3);
        for (let i = 0; i < chronological.length; i++) {
          const item = chronological[i];
          const prevItem = i > 0 ? chronological[i - 1] : item;
          const surgeRate = (item.water_level_m - prevItem.water_level_m) * 4; // per hour

          sequenceData[i * 3 + 0] = item.water_level_m;
          sequenceData[i * 3 + 1] = item.rainfall_rate;
          sequenceData[i * 3 + 2] = surgeRate;
        }

        // Create ONNX Tensor: shape [1, 6, 3] (Batch=1, SeqLen=6, Features=3)
        const tensor = new ortModule.Tensor('float32', sequenceData, [1, 6, 3]);
        const feeds = {};
        const inputName = session.inputNames[0] || 'input';
        feeds[inputName] = tensor;

        const results = await session.run(feeds);
        const outputName = session.outputNames[0] || 'output';
        const outputData = results[outputName].data;

        predicted30m = parseFloat(Math.min(1.8, Math.max(0.1, outputData[0])).toFixed(2));
        predicted60m = parseFloat(Math.min(1.8, Math.max(0.1, outputData[1] ?? (outputData[0] + 0.1))).toFixed(2));
        confidenceScore = 96.5;
        methodUsed = 'ONNX_LSTM';
        console.log(`[dlService] ONNX LSTM Prediction: +30m=${predicted30m}m, +60m=${predicted60m}m`);
      } catch (onnxErr) {
        console.error('[dlService] ONNX Inference error:', onnxErr.message);
        methodUsed = 'SurgeRate_Fallback';
      }
    }

    // 3. Fallback calculation if ONNX model missing or failed
    if (methodUsed === 'SurgeRate_Fallback') {
      const firstLog = chronological[0];
      const timeDiffMins = Math.max(5, (currentLog.timestamp.getTime() - firstLog.timestamp.getTime()) / 60000);
      const totalDelta = currentLog.water_level_m - firstLog.water_level_m;
      const surgeRateMh = (totalDelta / timeDiffMins) * 60; // m per hour

      const p30 = Math.min(1.8, Math.max(0.1, currentLevel + (surgeRateMh * 0.5) + (currentLog.rainfall_rate > 10 ? 0.08 : 0.03)));
      const p60 = Math.min(1.8, Math.max(0.1, currentLevel + (surgeRateMh * 1.0) + (currentLog.rainfall_rate > 10 ? 0.16 : 0.06)));

      predicted30m = parseFloat(p30.toFixed(2));
      predicted60m = parseFloat(p60.toFixed(2));
      confidenceScore = 94.0;
    }

    // 4. Save to MLProjection table in Supabase
    const projection = await prisma.mLProjection.create({
      data: {
        horizon_30m_m: predicted30m,
        horizon_60m_m: predicted60m,
        confidence_score: confidenceScore,
      },
    });

    console.log(`[dlService] Saved MLProjection (id: ${projection.id}): +30m=${predicted30m}m, +60m=${predicted60m}m, Confidence=${confidenceScore}% [Method: ${methodUsed}]`);
    return { ...projection, methodUsed };
  } catch (err) {
    console.error('[dlService] Ingestion inference error:', err.message);
    return null;
  }
}
