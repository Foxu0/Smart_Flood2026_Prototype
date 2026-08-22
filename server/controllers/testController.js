import { prisma } from '../db.js';
import { getEvaluationMetrics, resetEvaluation } from '../services/aiEvaluationService.js';
import { broadcast } from '../websocket.js';

/**
 * POST /api/v1/test/reset
 * Clears legacy test records from PostgreSQL tables to establish a clean baseline.
 */
export async function resetTestData(req, res) {
  try {
    console.log('[TestController] Resetting test telemetry and event logs...');

    const [deletedTelemetry, deletedEvents, deletedProjections] = await Promise.all([
      prisma.telemetryLog.deleteMany({}),
      prisma.systemEvent.deleteMany({}),
      prisma.mLProjection.deleteMany({}),
    ]);

    resetEvaluation();

    const result = {
      success: true,
      message: 'Test environment reset complete. Database tables truncated.',
      deletedRecords: {
        telemetry: deletedTelemetry.count,
        events: deletedEvents.count,
        projections: deletedProjections.count,
      },
    };

    // Broadcast reset event over WebSocket
    broadcast({ type: 'TEST_RESET', data: result });

    res.json(result);
  } catch (err) {
    console.error('[POST /test/reset]', err);
    res.status(500).json({ error: 'Failed to reset test data', detail: err.message });
  }
}

/**
 * GET /api/v1/test/ai-evaluation
 * Returns overall model metrics (MAE, RMSE, Accuracy %) and time-series comparison rows.
 */
export async function getAiEvaluation(req, res) {
  try {
    const metrics = getEvaluationMetrics();
    res.json({ success: true, data: metrics });
  } catch (err) {
    console.error('[GET /test/ai-evaluation]', err);
    res.status(500).json({ error: 'Failed to retrieve AI evaluation metrics', detail: err.message });
  }
}
