import { prisma } from '../db.js';

/**
 * Purges database logs (TelemetryLog, SystemEvent, MLProjection) older than the specified retention window.
 *
 * @param {number} retentionDays - Number of days of historical data to preserve (default: 30)
 * @returns {Promise<{success: boolean, retentionDays: number, deletedTelemetry: number, deletedEvents: number, deletedProjections: number}>}
 */
export async function purgeOldData(retentionDays = 30) {
  const days = Math.max(1, parseInt(retentionDays) || 30);
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    console.log(`[Retention] Running database purge for records older than ${days} days (cutoff: ${cutoffDate.toISOString()})...`);

    const [telemetryResult, eventResult, projectionResult] = await Promise.all([
      prisma.telemetryLog.deleteMany({
        where: { timestamp: { lt: cutoffDate } },
      }),
      prisma.systemEvent.deleteMany({
        where: { timestamp: { lt: cutoffDate } },
      }),
      prisma.mLProjection.deleteMany({
        where: { timestamp: { lt: cutoffDate } },
      }),
    ]);

    const stats = {
      success: true,
      retentionDays: days,
      cutoffDate: cutoffDate.toISOString(),
      deletedTelemetry: telemetryResult.count,
      deletedEvents: eventResult.count,
      deletedProjections: projectionResult.count,
    };

    console.log(
      `[Retention] Purge complete: ${stats.deletedTelemetry} telemetry logs, ${stats.deletedEvents} events, ${stats.deletedProjections} projections removed.`
    );

    // Log the purge event in SystemEvent
    await prisma.systemEvent.create({
      data: {
        event_code: 'DATA_RETENTION_PURGE',
        message: `DATA_RETENTION_PURGE: Cleaned records older than ${days} days. Deleted ${stats.deletedTelemetry} telemetry logs, ${stats.deletedEvents} events, ${stats.deletedProjections} projections.`,
        severity: 'INFO',
      },
    });

    return stats;
  } catch (err) {
    console.error('[Retention] Error during database purge:', err.message);
    throw err;
  }
}

/**
 * Starts an automated 24-hour scheduler that runs retention purge daily.
 *
 * @param {number} retentionDays - Number of days to retain (default: 30)
 */
export function startRetentionScheduler(retentionDays = 30) {
  const INTERVAL_24H = 24 * 60 * 60 * 1000;

  // Run initial check on startup after 1 minute delay
  setTimeout(() => {
    purgeOldData(retentionDays).catch((err) =>
      console.error('[Retention Scheduler] Initial purge failed:', err.message)
    );
  }, 60 * 1000);

  // Schedule recurring 24-hour interval
  setInterval(() => {
    purgeOldData(retentionDays).catch((err) =>
      console.error('[Retention Scheduler] Scheduled purge failed:', err.message)
    );
  }, INTERVAL_24H);

  console.log(`[Retention Scheduler] Initialized daily purge schedule (preserving last ${retentionDays} days).`);
}
