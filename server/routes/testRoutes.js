import express from 'express';
import { resetTestData, getAiEvaluation } from '../controllers/testController.js';
import { requirePermission } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Production Maintenance & AI Evaluation Endpoints ──────────────────────
router.post('/reset', requirePermission('system.maintenance'), resetTestData);
router.get('/ai-evaluation', getAiEvaluation);

export default router;
