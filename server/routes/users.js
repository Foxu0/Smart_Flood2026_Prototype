import express from 'express';
import { requirePermission } from '../middleware/authMiddleware.js';
import { listUsers, findUserById, findUserByUsername, createUser, updateUser, deleteUser, toPublicUser } from '../services/accountStore.js';
import { audit, listAuditLogs } from '../services/auditService.js';
import { MANAGEABLE_ROLES, BARANGAYS, ROLES, can } from '../../shared/roles.js';

const router = express.Router();

// All routes here require the users.manage permission (SUPERADMIN, MDRRMO).
// MDRRMO may only see and manage BARANGAY accounts (see MANAGEABLE_ROLES).
router.use(requirePermission('users.manage'));

const manageable = (req) => MANAGEABLE_ROLES[req.operator.role] || [];

function validateFields(body, { creating }) {
  const { username, password, role, barangay } = body;
  if (creating) {
    if (!username || !/^[a-zA-Z0-9._-]{3,32}$/.test(username)) return 'Username must be 3–32 letters, numbers, dots, dashes or underscores.';
    if (!password) return 'Password is required.';
    if (!role) return 'Role is required.';
  }
  if (password && String(password).length < 8) return 'Password must be at least 8 characters.';
  if (barangay && !BARANGAYS.includes(barangay)) return 'Unknown barangay.';
  if (role === ROLES.BARANGAY && creating && !barangay) return 'Barangay staff accounts must be assigned a barangay.';
  return null;
}

// GET /api/v1/users — list accounts the caller may manage
router.get('/', async (req, res) => {
  const users = await listUsers({ roles: manageable(req) });
  res.json({ success: true, data: await Promise.all(users.map(toPublicUser)) });
});

// GET /api/v1/users/audit — recent audit trail (SUPERADMIN)
router.get('/audit', async (req, res) => {
  if (!can(req.operator.role, 'audit.view')) return res.status(403).json({ success: false, error: 'Forbidden.' });
  res.json({ success: true, data: await listAuditLogs({ limit: parseInt(req.query.limit) || 100 }) });
});

// POST /api/v1/users — create account
// Body: { username, password, role, fullName?, email?, phone?, barangay? }
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const err = validateFields(body, { creating: true });
    if (err) return res.status(400).json({ success: false, error: err });
    if (!manageable(req).includes(body.role)) {
      return res.status(403).json({ success: false, error: `You cannot create ${body.role} accounts.` });
    }
    if (await findUserByUsername(body.username)) {
      return res.status(409).json({ success: false, error: 'Username already exists.' });
    }
    const user = await createUser({
      username: body.username,
      password: body.password,
      role: body.role,
      fullName: body.fullName || null,
      email: body.email || null,
      phone: body.phone || null,
      barangay: body.barangay || null,
    });
    audit(req.operator, 'user.create', user.username, { role: user.role, barangay: body.barangay || null });
    res.status(201).json({ success: true, data: await toPublicUser(user) });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.status ? e.message : 'Internal server error.' });
  }
});

// PUT /api/v1/users/:id — edit account (role, barangay, active flag, password reset)
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const target = await findUserById(id);
    if (!target || !manageable(req).includes(target.role)) {
      return res.status(404).json({ success: false, error: 'Account not found.' });
    }
    const body = req.body || {};
    const err = validateFields(body, { creating: false });
    if (err) return res.status(400).json({ success: false, error: err });
    if (body.role && !manageable(req).includes(body.role)) {
      return res.status(403).json({ success: false, error: `You cannot assign the ${body.role} role.` });
    }
    if (id === req.operator.sub && (body.isActive === false || (body.role && body.role !== target.role))) {
      return res.status(400).json({ success: false, error: 'You cannot disable or change the role of your own account.' });
    }

    const changes = {};
    for (const k of ['email', 'phone', 'barangay', 'role']) {
      if (body[k] !== undefined) changes[k] = body[k] || null;
    }
    if (body.fullName) changes.fullName = body.fullName; // required column — ignore blanks
    if (body.isActive !== undefined) changes.isActive = Boolean(body.isActive);
    if (body.password) changes.password = body.password;

    const updated = await updateUser(id, changes);
    audit(req.operator, 'user.update', target.username, { ...changes, password: changes.password ? '(reset)' : undefined });
    res.json({ success: true, data: await toPublicUser(updated) });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, error: e.status ? e.message : 'Internal server error.' });
  }
});

// DELETE /api/v1/users/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.operator.sub) return res.status(400).json({ success: false, error: 'You cannot delete your own account.' });
  const target = await findUserById(id);
  if (!target || !manageable(req).includes(target.role)) {
    return res.status(404).json({ success: false, error: 'Account not found.' });
  }
  await deleteUser(id);
  audit(req.operator, 'user.delete', target.username, { role: target.role });
  res.json({ success: true });
});

export default router;
