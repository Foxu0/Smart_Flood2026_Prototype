// In-memory evaluation tracking using Shifted Horizon Queue logic
let virtualStepCounter = 0;
const predictionQueue = [];
const evaluationLogs = [];

/**
 * Record prediction made at virtual step t (targets step t + 3 for +30m forecast)
 *
 * @param {object} projection - { predicted30m, predicted60m, methodUsed }
 */
export function recordPrediction(projection) {
  if (!projection) return;

  const pred30 = parseFloat(projection.predicted30m ?? projection.horizon_30m_m ?? 0);
  const pred60 = parseFloat(projection.predicted60m ?? projection.horizon_60m_m ?? 0);

  // Push into in-memory horizon queue targeting virtual step t + 3 (+30 mins ahead)
  predictionQueue.push({
    originStep: virtualStepCounter,
    targetStep: virtualStepCounter + 3,
    predictedValue: pred30,
    predicted60m: pred60,
    originTimestamp: new Date(),
    methodUsed: projection.methodUsed || 'ONNX_LSTM',
  });

  if (predictionQueue.length > 50) {
    predictionQueue.shift();
  }
}

/**
 * When step t arrives (ground truth resolution):
 * 1. virtualStepCounter++
 * 2. Match entries in predictionQueue where targetStep === virtualStepCounter
 * 3. Calculate error and accuracy % against arriving actual water level
 *
 * @param {object} actualLog - { timestamp, water_level_m }
 */
export function recordActualAndEvaluate(actualLog) {
  if (!actualLog || actualLog.water_level_m == null) return;

  virtualStepCounter++;
  const actual = parseFloat(actualLog.water_level_m);

  // Find entries in predictionQueue where targetStep === virtualStepCounter
  const matchedIndices = [];
  for (let i = 0; i < predictionQueue.length; i++) {
    if (predictionQueue[i].targetStep === virtualStepCounter) {
      matchedIndices.push(i);
    }
  }

  for (const idx of matchedIndices) {
    const entry = predictionQueue[idx];
    const actual = parseFloat(actualLog.water_level_m);
    const predicted = entry.predictedValue;
    const error = Math.abs(actual - predicted);

    // Use a normalization baseline of at least 1.0m to prevent divide-by-fraction distortion
    const denominator = Math.max(actual, 1.0);
    const accuracy = Math.max(0, (1 - (error / denominator)) * 100);

    const timeStr = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    evaluationLogs.unshift({
      id: evaluationLogs.length + 1,
      stepEvaluated: virtualStepCounter,
      predictionMadeAtStep: entry.originStep,
      time: timeStr,
      timestamp: actualLog.timestamp instanceof Date ? actualLog.timestamp.toISOString() : new Date().toISOString(),
      actual: actual.toFixed(2),
      predicted: predicted.toFixed(2),
      error: error.toFixed(2),
      accuracy: accuracy.toFixed(1) + '%',
      actual_m: actual,
      predicted30m_m: predicted,
      error30m_m: parseFloat(error.toFixed(3)),
      accuracy30m_pct: parseFloat(Math.min(100, Math.max(0, accuracy)).toFixed(1)),
      methodUsed: entry.methodUsed,
    });
  }

  // Remove matched entries from predictionQueue
  if (matchedIndices.length > 0) {
    for (let i = predictionQueue.length - 1; i >= 0; i--) {
      if (predictionQueue[i].targetStep <= virtualStepCounter) {
        predictionQueue.splice(i, 1);
      }
    }
  }

  if (evaluationLogs.length > 50) {
    evaluationLogs.pop();
  }
}

/**
 * Metric Summary Calculation:
 * Compute MAE, RMSE, and AVG ACCURACY only from resolved pairs in evaluationLogs.
 *
 * @returns {object} Summary metrics: { totalEvaluated, virtualStepCounter, mae_m, rmse_m, avgAccuracy_pct, methodUsed, history }
 */
export function getEvaluationMetrics() {
  if (evaluationLogs.length === 0) {
    return {
      totalEvaluated: 0,
      virtualStepCounter,
      mae_m: 0.0,
      rmse_m: 0.0,
      avgAccuracy_pct: 'Evaluating (+30m in progress...)',
      methodUsed: 'ONNX_LSTM (flood_lstm.onnx)',
      history: [],
    };
  }

  const errors = evaluationLogs.map((e) => e.error30m_m);
  const accuracies = evaluationLogs.map((e) => e.accuracy30m_pct);

  const mae = errors.reduce((sum, err) => sum + err, 0) / errors.length;
  const squaredErrorsSum = errors.reduce((sum, err) => sum + err * err, 0);
  const rmse = Math.sqrt(squaredErrorsSum / errors.length);
  const avgAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;

  return {
    totalEvaluated: evaluationLogs.length,
    virtualStepCounter,
    mae_m: parseFloat(mae.toFixed(3)),
    rmse_m: parseFloat(rmse.toFixed(3)),
    avgAccuracy_pct: parseFloat(Math.min(100, Math.max(0, avgAccuracy)).toFixed(1)),
    methodUsed: evaluationLogs[0]?.methodUsed || 'ONNX_LSTM (flood_lstm.onnx)',
    history: evaluationLogs,
  };
}

/**
 * Resets all evaluation buffers and virtual step counter.
 */
export function resetEvaluation() {
  virtualStepCounter = 0;
  predictionQueue.length = 0;
  evaluationLogs.length = 0;
  console.log('[AIEvaluationService] Shifted Horizon Queue and evaluation metrics reset.');
}
