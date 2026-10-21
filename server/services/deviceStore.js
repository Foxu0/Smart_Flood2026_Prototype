import { prisma } from '../db.js';
import { hashSecret, verifySecret, generateDeviceKey, parseDeviceKeyPrefix } from '../lib/crypto.js';
import { barangayIdByName, barangayNameById, defaultCoordinates } from './barangayStore.js';

/**
 * Hardware registry (table: hardware_nodes). A node is a monitoring SITE; replacing
 * the physical ESP32 keeps the node and its telemetry history — the swap is logged in
 * hardware_change_logs and the API key is rotated.
 *
 * Each board authenticates telemetry with its own API key (X-Device-Key header).
 * Only a hash is stored; the plaintext key is returned once on create/rotate/replace.
 * Prisma-backed with an in-memory fallback.
 *
 * The API speaks { nodeId (= node_code), barangay: name, sensors: [] }.
 */
const memoryNodes = [];
const memoryChangeLogs = [];
const memoryWindows = [];
let memoryNextId = 1;

// A board that has not reported for this long is shown as "Not reporting"
const OFFLINE_AFTER_MS = parseInt(process.env.DEVICE_OFFLINE_AFTER_SEC || '120') * 1000;

export async function toPublicDevice(n) {
  if (!n) return null;
  const lastSeen = n.lastSeenAt ? new Date(n.lastSeenAt).getTime() : null;
  return {
    id: n.id,
    nodeId: n.nodeCode,
    name: n.name,
    barangay: await barangayNameById(n.barangayId),
    locationLabel: n.locationLabel ?? null,
    latitude: n.latitude,
    longitude: n.longitude,
    mountHeightCm: n.mountHeightCm,
    bankHeightM: n.bankHeightM ?? null,
    sensors: String(n.sensors || '').split(',').filter(Boolean),
    boardSerial: n.boardSerial ?? null,
    firmwareVersion: n.firmwareVersion ?? null,
    status: n.status,
    hasKey: Boolean(n.deviceKeyHash),
    apiKeyPrefix: n.deviceKeyPrefix ?? null,
    notes: n.notes ?? null,
    isDefault: Boolean(n.isDefault),
    installedAt: n.installedAt,
    lastSeenAt: n.lastSeenAt ?? null,
    connectivity: !lastSeen ? 'NEVER_SEEN' : (Date.now() - lastSeen > OFFLINE_AFTER_MS ? 'OFFLINE' : 'ONLINE'),
  };
}

/** Convert API fields → table fields */
async function toRow(fields) {
  const { nodeId, barangay, sensors, ...rest } = fields;
  const row = { ...rest };
  if (nodeId !== undefined) row.nodeCode = nodeId;
  if (barangay !== undefined) row.barangayId = await barangayIdByName(barangay);
  if (sensors !== undefined) row.sensors = Array.isArray(sensors) ? sensors.join(',') : sensors;
  return row;
}

const duplicate = () => Object.assign(new Error('A board with this Node ID already exists.'), { status: 409 });

export async function logChange(nodeId, action, details, performedBy) {
  const data = { nodeId, action, details: details ?? null, performedBy: performedBy || 'system' };
  try {
    await prisma.hardwareChangeLog.create({ data });
  } catch (_e) {
    memoryChangeLogs.unshift({ id: memoryChangeLogs.length + 1, createdAt: new Date(), ...data });
  }
}

export async function listChangeLogs(nodeId) {
  try {
    return await prisma.hardwareChangeLog.findMany({ where: { nodeId }, orderBy: { createdAt: 'desc' }, take: 50 });
  } catch (_e) {
    return memoryChangeLogs.filter((c) => c.nodeId === nodeId);
  }
}

/** True when the barangay has at least one station (not retired) — residents there can get alerts. */
export async function barangayHasStation(barangay) {
  return (await listDevices({ barangay })).some((n) => n.status !== 'RETIRED');
}

export async function listDevices({ barangay } = {}) {
  const barangayId = barangay ? await barangayIdByName(barangay) : undefined;
  const where = barangayId ? { barangayId } : {};
  try {
    return await prisma.hardwareNode.findMany({ where, orderBy: [{ status: 'asc' }, { nodeCode: 'asc' }] });
  } catch (_e) {
    return memoryNodes
      .filter((n) => !barangayId || n.barangayId === barangayId)
      .sort((a, b) => a.nodeCode.localeCompare(b.nodeCode));
  }
}

export async function findDeviceById(id) {
  try {
    return await prisma.hardwareNode.findUnique({ where: { id } });
  } catch (_e) {
    return memoryNodes.find((n) => n.id === id) || null;
  }
}

/** The node that unkeyed telemetry (current firmware / simulators) is attributed to. */
export async function findDefaultNode() {
  try {
    return await prisma.hardwareNode.findFirst({ where: { isDefault: true, status: { not: 'RETIRED' } } });
  } catch (_e) {
    return memoryNodes.find((n) => n.isDefault && n.status !== 'RETIRED') || null;
  }
}

export async function createDevice(fields, performedBy) {
  const { key, prefix } = generateDeviceKey();
  const row = await toRow(fields);
  if (row.latitude == null || row.longitude == null) {
    const c = await defaultCoordinates(row.barangayId);
    row.latitude ??= c.latitude;
    row.longitude ??= c.longitude;
  }
  const data = {
    sensors: 'WATER_LEVEL,FLOW_SPEED',
    ...row,
    deviceKeyHash: hashSecret(key),
    deviceKeyPrefix: prefix,
  };
  let device;
  try {
    device = await prisma.hardwareNode.create({ data });
  } catch (err) {
    if (err?.code === 'P2002') throw duplicate();
    if (memoryNodes.some((n) => n.nodeCode === data.nodeCode)) throw duplicate();
    const now = new Date();
    device = {
      id: memoryNextId++, barangayId: null, locationLabel: null, mountHeightCm: 240, bankHeightM: null,
      boardSerial: null, firmwareVersion: null, status: 'ACTIVE', notes: null, isDefault: false,
      installedAt: now, lastSeenAt: null, createdAt: now, updatedAt: now, ...data,
    };
    memoryNodes.push(device);
  }
  await logChange(device.id, 'ADDED', fields.notes || null, performedBy);
  return { device, apiKey: key };
}

export async function updateDevice(id, fields) {
  const data = await toRow(fields);
  try {
    return await prisma.hardwareNode.update({ where: { id }, data });
  } catch (err) {
    if (err?.code === 'P2025') return null;
    if (err?.code === 'P2002') throw duplicate();
    const row = memoryNodes.find((n) => n.id === id);
    if (!row) return null;
    Object.assign(row, data, { updatedAt: new Date() });
    return row;
  }
}

/**
 * Swap in a new physical board at the same site. The node keeps its id, location and
 * history; board details are updated and a fresh API key is issued.
 */
export async function replaceBoard(id, { boardSerial, firmwareVersion, mountHeightCm, sensors, notes }, performedBy) {
  const old = await findDeviceById(id);
  if (!old) return null;
  if (old.status === 'RETIRED') throw Object.assign(new Error('This site is retired.'), { status: 400 });

  const { key, prefix } = generateDeviceKey();
  const changes = {
    boardSerial: boardSerial ?? null,
    firmwareVersion: firmwareVersion ?? null,
    deviceKeyHash: hashSecret(key),
    deviceKeyPrefix: prefix,
    installedAt: new Date(),
    lastSeenAt: null,
    ...(old.status === 'OFFLINE' ? { status: 'ACTIVE' } : {}),
  };
  if (mountHeightCm !== undefined) changes.mountHeightCm = mountHeightCm;
  if (sensors !== undefined) changes.sensors = sensors;
  const device = await updateDevice(id, changes);

  await logChange(id, 'REPLACED', JSON.stringify({
    oldBoardSerial: old.boardSerial, newBoardSerial: boardSerial ?? null, notes: notes ?? null,
  }), performedBy);
  return { device, apiKey: key };
}

// ── Maintenance mode ─────────────────────────────────────────────────────────
// Turning a board Off sets status=MAINTENANCE and opens a maintenance_windows row (history).

export async function setNodeMaintenance(id, enabled, reason, performedBy) {
  const device = await updateDevice(id, { status: enabled ? 'MAINTENANCE' : 'ACTIVE' });
  if (!device) return null;
  try {
    if (enabled) {
      await prisma.maintenanceWindow.create({ data: { scope: 'NODE', nodeId: id, reason: reason || 'Maintenance', createdByName: performedBy } });
    } else {
      await prisma.maintenanceWindow.updateMany({ where: { scope: 'NODE', nodeId: id, active: true }, data: { active: false, endedAt: new Date() } });
    }
  } catch (_e) {
    if (enabled) memoryWindows.push({ id: memoryWindows.length + 1, scope: 'NODE', nodeId: id, reason, active: true, startedAt: new Date(), endsAt: null });
    else memoryWindows.filter((w) => w.nodeId === id && w.active).forEach((w) => { w.active = false; w.endedAt = new Date(); });
  }
  await logChange(id, enabled ? 'MAINTENANCE_START' : 'MAINTENANCE_END', reason || null, performedBy);
  return device;
}

// ── Telemetry authentication ─────────────────────────────────────────────────

/** Resolve a board from its API key; null if unknown, retired or wrong key. */
export async function authenticateDeviceKey(key) {
  if (!key) return null;
  const prefix = parseDeviceKeyPrefix(key);
  let candidates;
  try {
    candidates = await prisma.hardwareNode.findMany({
      where: prefix
        ? { deviceKeyPrefix: prefix, status: { not: 'RETIRED' } }
        : { deviceKeyPrefix: null, deviceKeyHash: { not: null }, status: { not: 'RETIRED' } }, // older key format
    });
  } catch (_e) {
    candidates = memoryNodes.filter((n) => n.status !== 'RETIRED' && (prefix ? n.deviceKeyPrefix === prefix : !n.deviceKeyPrefix && n.deviceKeyHash));
  }
  return candidates.find((n) => verifySecret(key, n.deviceKeyHash)) || null;
}

export async function touchDevice(id, firmwareVersion) {
  const data = { lastSeenAt: new Date() };
  if (firmwareVersion) data.firmwareVersion = String(firmwareVersion);
  return updateDevice(id, data);
}
