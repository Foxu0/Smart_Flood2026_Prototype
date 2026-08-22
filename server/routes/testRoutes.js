import express from 'express';
import { resetTestData, getAiEvaluation } from '../controllers/testController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Production Maintenance & AI Evaluation Endpoints ──────────────────────
router.post('/reset', authMiddleware, resetTestData);
router.get('/ai-evaluation', getAiEvaluation);

export default router;
