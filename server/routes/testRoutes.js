import express from 'express';
import { resetTestData, getAiEvaluation, runSimulationStream } from '../controllers/testController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── POST /api/v1/test/reset ──────────────────────────────────────────────────
// Authenticated endpoint to purge legacy test records and reset evaluation metrics
router.post('/reset', authMiddleware, resetTestData);

// ── GET /api/v1/test/ai-evaluation ───────────────────────────────────────────
// Returns side-by-side comparison array and summary accuracy metrics (MAE, RMSE, Accuracy %)
router.get('/ai-evaluation', getAiEvaluation);

// ── POST /api/v1/test/simulate ───────────────────────────────────────────────
// Authenticated endpoint to trigger 20-step synthetic hydrological storm simulation stream
router.post('/simulate', authMiddleware, runSimulationStream);

export default router;
