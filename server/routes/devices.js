import express from 'express';
import { requirePermission } from '../middleware/authMiddleware.js';
import {
  listDevices, findDeviceById, createDevice, updateDevice, replaceBoard, rotateDeviceKey,
  deleteDevice, toPublicDevice, setNodeMaintenance, getGlobalMaintenance, setGlobalMaintenance,
  listChangeLogs, logChange,
} from '../services/deviceStore.js';
import { audit } from '../services/auditService.js';
import { broadcast } from '../websocket.js';
import { BARANGAYS, BARANGAY_SCOPED_ROLES, DEVICE_STATUSES, SENSOR_TYPES } from '../../shared/roles.js';

const router = express.Router();

// Barangay staff only see / manage boards in their own barangay
const scopeBarangay = (req) => (BARANGAY_SCOPED_ROLES.includes(req.operator.role) ? req.operator.barangay : null);

const publicList = (rows) => Promise.all(rows.map(toPublicDevice));

async function loadScopedDevice(req, res) {
  const device = await findDeviceById(parseInt(req.params.id));
  const pub = await toPublicDevice(device);
  const scope = scopeBarangay(req);
  if (!device || (scope && pub.barangay !== scope)) {
    res.status(404).json({ success: false, error: 'Board not found.' });
    return null;
  }
  return device;
}

function pickDeviceFields(body) {
  const out = {};
  for (const k of ['nodeId', 'name', 'barangay', 'locationLabel', 'firmwareVersion', 'boardSerial', 'notes']) {
    if (body[k] !== undefined) out[k] = body[k] === '' || body[k] === null ? null : String(body[k]).trim();
  }
  for (const k of ['latitude', 'longitude', 'mountHeightCm', 'bankHeightM']) {
    if (body[k] === undefined) continue;
    const n = parseFloat(body[k]);
    out[k] = Number.isFinite(n) ? n : null;
  }
  if (body.sensors !== undefined) out.sensors = body.sensors;
  // Required columns can't be cleared
  for (const k of ['nodeId', 'name', 'barangay', 'mountHeightCm', 'latitude', 'longitude']) {
    if (out[k] === null) delete out[k];
  }
  return out;
}

function validateDevice(fields, { creating }) {
  if (creating && (!fields.nodeId || !fields.name)) return 'Node ID and name are required.';
  if (fields.nodeId && !/^[A-Za-z0-9_-]{3,40}$/.test(fields.nodeId)) return 'Node ID must be 3–40 letters, numbers, dashes or underscores.';
  if (fields.barangay && !BARANGAYS.includes(fields.barangay)) return 'Unknown barangay.';
  if (fields.mountHeightCm !== undefined && !(fields.mountHeightCm > 0 && fields.mountHeightCm < 2000)) return 'Mount height must be between 0 and 2000 cm.';
  if (fields.sensors !== undefined) {
    const list = Array.isArray(fields.sensors) ? fields.sensors : String(fields.sensors).split(',');
    if (!list.length || list.some((s) => !SENSOR_TYPES[s])) return 'Unknown sensor type.';
  }
  return null;
}

const fail = (res, e) => res.status(e.status || 500).json({ success: false, error: e.status ? e.message : 'Internal server error.' });

function notifyRegistryChanged() {
  broadcast({ type: 'DEVICE_REGISTRY_CHANGED', data: { at: new Date().toISOString() } });
}

// GET /api/v1/devices — list boards (barangay-scoped for BARANGAY role)
router.get('/', requirePermission('devices.view'), async (req, res) => {
  const devices = await listDevices({ barangay: scopeBarangay(req) });
  res.json({ success: true, data: await publicList(devices), globalMaintenance: await getGlobalMaintenance() });
});

// POST /api/v1/devices/maintenance/global — Body: { enabled, reason?, endsAt? } (SUPERADMIN)
router.post('/maintenance/global', requirePermission('system.maintenance'), async (req, res) => {
  const { enabled, reason, endsAt } = req.body || {};
  const win = await setGlobalMaintenance(Boolean(enabled), { reason, endsAt }, req.operator.username);
  audit(req.operator, enabled ? 'maintenance.global_on' : 'maintenance.global_off', null, reason || null);
  notifyRegistryChanged();
  res.json({ success: true, data: win });
});

router.get('/:id', requirePermission('devices.view'), async (req, res) => {
  const device = await loadScopedDevice(req, res);
  if (device) res.json({ success: true, data: await toPublicDevice(device), history: await listChangeLogs(device.id) });
});

// POST /api/v1/devices — register ("add board"). Returns the API key ONCE.
router.post('/', requirePermission('devices.manage'), async (req, res) => {
  try {
    const fields = pickDeviceFields(req.body || {});
    const scope = scopeBarangay(req);
    if (scope) fields.barangay = scope;
    const err = validateDevice(fields, { creating: true });
    if (err) return res.status(400).json({ success: false, error: err });

    const { device, apiKey } = await createDevice(fields, req.operator.username);
    audit(req.operator, 'device.create', device.nodeCode, { barangay: fields.barangay });
    notifyRegistryChanged();
    res.status(201).json({ success: true, data: await toPublicDevice(device), apiKey });
  } catch (e) { fail(res, e); }
});

// PUT /api/v1/devices/:id — edit details / calibration
router.put('/:id', requirePermission('devices.manage'), async (req, res) => {
  try {
    const device = await loadScopedDevice(req, res);
    if (!device) return;
    const fields = pickDeviceFields(req.body || {});
    if (scopeBarangay(req)) delete fields.barangay;
    const err = validateDevice(fields, { creating: false });
    if (err) return res.status(400).json({ success: false, error: err });

    const updated = await updateDevice(device.id, fields);
    await logChange(device.id, 'UPDATED', JSON.stringify(fields), req.operator.username);
    audit(req.operator, 'device.update', device.nodeCode, fields);
    notifyRegistryChanged();
    res.json({ success: true, data: await toPublicDevice(updated) });
  } catch (e) { fail(res, e); }
});

// POST /api/v1/devices/:id/maintenance — Body: { enabled: boolean, reason?: string }
// While in MAINTENANCE, telemetry is still stored but automated alerts are suppressed.
router.post('/:id/maintenance', requirePermission('devices.maintenance'), async (req, res) => {
  const device = await loadScopedDevice(req, res);
  if (!device) return;
  if (device.status === 'RETIRED') return res.status(400).json({ success: false, error: 'Retired boards cannot change status.' });
  const enabled = Boolean(req.body?.enabled);
  const updated = await setNodeMaintenance(device.id, enabled, req.body?.reason, req.operator.username);
  audit(req.operator, enabled ? 'device.maintenance_on' : 'device.maintenance_off', device.nodeCode, req.body?.reason || null);
  notifyRegistryChanged();
  res.json({ success: true, data: await toPublicDevice(updated) });
});

// POST /api/v1/devices/:id/replace — swap the physical board at this site (history kept)
// Body: { boardSerial?, firmwareVersion?, mountHeightCm?, sensors?, notes? }
router.post('/:id/replace', requirePermission('devices.manage'), async (req, res) => {
  try {
    const device = await loadScopedDevice(req, res);
    if (!device) return;
    const f = pickDeviceFields(req.body || {});
    const err = validateDevice(f, { creating: false });
    if (err) return res.status(400).json({ success: false, error: err });

    const result = await replaceBoard(device.id, {
      boardSerial: f.boardSerial, firmwareVersion: f.firmwareVersion,
      mountHeightCm: f.mountHeightCm,
      sensors: f.sensors !== undefined ? (Array.isArray(f.sensors) ? f.sensors.join(',') : f.sensors) : undefined,
      notes: f.notes,
    }, req.operator.username);
    audit(req.operator, 'device.replace', device.nodeCode, { boardSerial: f.boardSerial ?? null });
    notifyRegistryChanged();
    res.json({ success: true, data: await toPublicDevice(result.device), apiKey: result.apiKey });
  } catch (e) { fail(res, e); }
});

// POST /api/v1/devices/:id/rotate-key — issue a new API key (old key stops working)
router.post('/:id/rotate-key', requirePermission('devices.manage'), async (req, res) => {
  const device = await loadScopedDevice(req, res);
  if (!device) return;
  const result = await rotateDeviceKey(device.id, req.operator.username);
  audit(req.operator, 'device.rotate_key', device.nodeCode);
  res.json({ success: true, data: await toPublicDevice(result.device), apiKey: result.apiKey });
});

// PUT /api/v1/devices/:id/status — Body: { status } (e.g. RETIRED to decommission a site)
router.put('/:id/status', requirePermission('devices.manage'), async (req, res) => {
  const device = await loadScopedDevice(req, res);
  if (!device) return;
  const { status } = req.body || {};
  if (!DEVICE_STATUSES.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status.' });
  if (status === 'MAINTENANCE') return res.status(400).json({ success: false, error: 'Use the maintenance endpoint.' });
  const updated = await updateDevice(device.id, { status });
  await logChange(device.id, status === 'RETIRED' ? 'RETIRED' : `STATUS_${status}`, null, req.operator.username);
  audit(req.operator, 'device.status', device.nodeCode, status);
  notifyRegistryChanged();
  res.json({ success: true, data: await toPublicDevice(updated) });
});

// DELETE /api/v1/devices/:id — hard delete (SUPERADMIN). Telemetry rows keep their data.
router.delete('/:id', requirePermission('devices.delete'), async (req, res) => {
  const device = await loadScopedDevice(req, res);
  if (!device) return;
  if (device.isDefault) return res.status(400).json({ success: false, error: 'The default site cannot be deleted.' });
  await deleteDevice(device.id);
  audit(req.operator, 'device.delete', device.nodeCode);
  notifyRegistryChanged();
  res.json({ success: true });
});

export default router;
