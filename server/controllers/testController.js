import { prisma } from '../db.js';
import { broadcast } from '../websocket.js';
import { audit } from '../services/auditService.js';

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

    const result = {
      success: true,
      message: 'Test environment reset complete. Database tables truncated.',
      deletedRecords: {
        telemetry: deletedTelemetry.count,
        events: deletedEvents.count,
        projections: deletedProjections.count,
      },
    };

    audit(req.operator, 'logs.reset', null, result.deletedRecords);

    // Broadcast reset event over WebSocket
    broadcast({ type: 'TEST_RESET', data: result });

    res.json(result);
  } catch (err) {
    console.error('[POST /test/reset]', err);
    res.status(500).json({ error: 'Failed to reset test data', detail: err.message });
  }
}
