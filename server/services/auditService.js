import { prisma } from '../db.js';

export const memoryAuditLogs = [];

/**
 * Record an audit entry (table: audit_logs). `actor` is a JWT payload
 * ({ username, role }) or omitted for automated actions, which are logged as SYSTEM.
 * Never throws — auditing must not break the request.
 */
export async function audit(actor, action, target = null, detail = null) {
  const entry = {
    actorType:  actor?.role ?? 'SYSTEM',
    actorName:  actor?.username ?? 'system',
    action,
    targetType: action.includes('.') ? action.split('.')[0] : null,
    targetId:   target != null ? String(target) : null,
    details:    detail != null ? (typeof detail === 'string' ? detail : JSON.stringify(detail)) : null,
  };
  try {
    return await prisma.auditLog.create({ data: entry });
  } catch (_e) {
    const row = { id: memoryAuditLogs.length + 1, createdAt: new Date(), ...entry };
    memoryAuditLogs.unshift(row);
    if (memoryAuditLogs.length > 500) memoryAuditLogs.pop();
    return row;
  }
}

export async function listAuditLogs({ limit = 100 } = {}) {
  let rows;
  try {
    rows = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: Math.min(limit, 500) });
  } catch (_e) {
    rows = memoryAuditLogs.slice(0, limit);
  }
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    actorName: r.actorName,
    actorRole: r.actorType,
    action: r.action,
    target: r.targetId,
    detail: r.details,
  }));
}
