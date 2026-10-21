import express from 'express';
import { requirePermission } from '../middleware/authMiddleware.js';
import { listSmsResidents, addSmsResident, findSmsResident, deleteSmsResident, smsMode } from '../services/smsService.js';
import { audit } from '../services/auditService.js';
import { BARANGAYS, BARANGAY_SCOPED_ROLES } from '../../shared/roles.js';
import { signupLimit } from '../middleware/signupLimit.js';

const router = express.Router();

// POST /api/v1/sms-residents/signup — public: a resident registers their own number on the website
// Body: { fullName?, phone, barangay }
router.post('/signup', signupLimit, async (req, res) => {
  try {
    const barangay = req.body?.barangay;
    if (!BARANGAYS.includes(barangay)) return res.status(400).json({ success: false, error: 'Choose your barangay.' });
    const resident = await addSmsResident({ fullName: req.body?.fullName?.trim().slice(0, 100), phone: req.body?.phone, barangay });
    res.status(201).json({ success: true, data: { phone: resident.phone, barangay: resident.barangay } });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.status ? err.message : 'Could not sign up. Please try again.' });
  }
});

// Everything below is for staff. Barangay staff manage their own barangay; CDRRMO sees all.
router.use(requirePermission('residents.manage'));
const scopeBarangay = (req) => (BARANGAY_SCOPED_ROLES.includes(req.operator.role) ? req.operator.barangay : null);

// GET /api/v1/sms-residents
router.get('/', async (req, res) => {
  try {
    const data = await listSmsResidents({ barangay: scopeBarangay(req) });
    res.json({ success: true, data, mode: smsMode() });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not load SMS residents.', detail: err.message });
  }
});

// POST /api/v1/sms-residents — Body: { fullName, phone, barangay? }
router.post('/', async (req, res) => {
  try {
    const barangay = scopeBarangay(req) || req.body?.barangay;
    if (!BARANGAYS.includes(barangay)) return res.status(400).json({ success: false, error: 'Choose a barangay.' });
    const resident = await addSmsResident({ fullName: req.body?.fullName?.trim(), phone: req.body?.phone, barangay });
    audit(req.operator, 'sms.add', resident.fullName || resident.phone, { barangay });
    res.status(201).json({ success: true, data: resident });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.status ? err.message : 'Could not add the resident.' });
  }
});

// DELETE /api/v1/sms-residents/:id
router.delete('/:id', async (req, res) => {
  try {
    const resident = await findSmsResident(parseInt(req.params.id));
    const scope = scopeBarangay(req);
    if (!resident || (scope && resident.barangay !== scope)) return res.status(404).json({ success: false, error: 'Resident not found.' });
    await deleteSmsResident(resident.id);
    audit(req.operator, 'sms.delete', resident.fullName || resident.phone, { barangay: resident.barangay });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not remove the resident.', detail: err.message });
  }
});

export default router;
