import express from 'express';
import { resetTestData } from '../controllers/testController.js';
import { requirePermission } from '../middleware/authMiddleware.js';

const router = express.Router();

// Super Admin: delete all readings, events and forecasts (Reports → Reset logs)
router.post('/reset', requirePermission('system.maintenance'), resetTestData);

export default router;
