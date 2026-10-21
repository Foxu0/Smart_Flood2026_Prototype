import express from 'express';
import { prisma } from '../db.js';
import { requirePermission } from '../middleware/authMiddleware.js';
import {
  listDevices, findDeviceById, createDevice, updateDevice, replaceBoard,
  toPublicDevice, setNodeMaintenance,
  listChangeLogs, logChange,
} from '../services/deviceStore.js';
import { audit } from '../services/auditService.js';
import { getThresholds, setNodeThresholds, clearNodeThresholds, validateThresholds } from '../services/thresholdStore.js';
import { broadcast } from '../websocket.js';
import { BARANGAYS, BARANGAY_SCOPED_ROLES, SENSOR_TYPES } from '../../shared/roles.js';

const router = express.Router();

// Barangay staff only see / manage boards in their own barangay
const scopeBarangay = (req) => (BARANGAY_SCOPED_ROLES.includes(req.operator.role) ? req.operator.barangay : null);

// Public device shape + the alert thresholds that apply to it
async function withThresholds(device) {
  const pub = await toPublicDevice(device);
  return pub && { ...pub, thresholds: await getThresholds(device.id) };
}
const publicList = (rows) => Promise.all(rows.map(withThresholds));

const BLIND_SPOT_M = parseFloat(process.env.SENSOR_BLIND_SPOT_CM ?? 25) / 100;

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
  res.json({ success: true, data: await publicList(devices) });
});

// GET /api/v1/devices/summary — every board with its latest water level and alert level
// (used by the dashboards; barangay staff only get their barangay)
router.get('/summary', requirePermission('devices.view'), async (req, res) => {
  const devices = (await listDevices({ barangay: scopeBarangay(req) })).filter((d) => d.status !== 'RETIRED');
  const data = await Promise.all(devices.map(async (d) => {
    const base = await withThresholds(d);
    let latest = null;
    try {
      latest = await prisma.telemetryLog.findFirst({
        where: { nodeId: d.id },
        orderBy: { recordedAt: 'desc' },
        select: { waterLevelM: true, recordedAt: true },
      });
    } catch (_e) { /* no database */ }
    const t = base.thresholds;
    const level = !latest ? null
      : latest.waterLevelM >= t.level3_danger ? 3
      : latest.waterLevelM >= t.level2_alarm ? 2
      : latest.waterLevelM >= t.level1_watch ? 1 : 0;
    return { ...base, latest, level };
  }));
  res.json({ success: true, data });
});

router.get('/:id', requirePermission('devices.view'), async (req, res) => {
  const device = await loadScopedDevice(req, res);
  if (device) res.json({ success: true, data: await withThresholds(device), history: await listChangeLogs(device.id) });
});

// PUT /api/v1/devices/:id/thresholds — this board's own alert levels (metres)
// Body: { level1_watch, level2_alarm, level3_danger }   (Level 3 = spill level)
router.put('/:id/thresholds', requirePermission('thresholds.manage'), async (req, res) => {
  const device = await loadScopedDevice(req, res);
  if (!device) return;
  const t = {
    level1_watch:  parseFloat(req.body?.level1_watch),
    level2_alarm:  parseFloat(req.body?.level2_alarm),
    level3_danger: parseFloat(req.body?.level3_danger),
  };
  const maxStage = device.mountHeightCm / 100 - BLIND_SPOT_M;
  const err = validateThresholds(t, maxStage);
  if (err) return res.status(400).json({ success: false, error: err });
  const thresholds = await setNodeThresholds(device.id, t);
  await logChange(device.id, 'THRESHOLDS_UPDATED', JSON.stringify(t), req.operator.username);
  audit(req.operator, 'device.thresholds', device.nodeCode, t);
  notifyRegistryChanged();
  res.json({ success: true, data: thresholds });
});

// DELETE /api/v1/devices/:id/thresholds — go back to the default levels
router.delete('/:id/thresholds', requirePermission('thresholds.manage'), async (req, res) => {
  const device = await loadScopedDevice(req, res);
  if (!device) return;
  const thresholds = await clearNodeThresholds(device.id);
  await logChange(device.id, 'THRESHOLDS_RESET', null, req.operator.username);
  audit(req.operator, 'device.thresholds_reset', device.nodeCode);
  notifyRegistryChanged();
  res.json({ success: true, data: thresholds });
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

// POST /api/v1/devices/:id/maintenance — turn a board Off/On. Body: { enabled: boolean }
// enabled = true → board is Off (status MAINTENANCE): readings are stored but no alerts or siren.
router.post('/:id/maintenance', requirePermission('devices.maintenance'), async (req, res) => {
  const device = await loadScopedDevice(req, res);
  if (!device) return;
  if (device.status === 'RETIRED') return res.status(400).json({ success: false, error: 'Retired boards cannot change status.' });
  const enabled = Boolean(req.body?.enabled);
  const updated = await setNodeMaintenance(device.id, enabled, req.body?.reason, req.operator.username);
  audit(req.operator, enabled ? 'device.turned_off' : 'device.turned_on', device.nodeCode);
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

export default router;
