import express from 'express';
import { resetTestData, getAiEvaluation, runSimulationStream } from '../controllers/testController.js';
import { getScenariosList, getScenarioStatus, runScenario, stopScenario } from '../controllers/scenarioController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// ── Test & Reset Routes ───────────────────────────────────────────────────────
router.post('/reset', authMiddleware, resetTestData);
router.get('/ai-evaluation', getAiEvaluation);
router.post('/simulate', authMiddleware, runSimulationStream);

// ── Scenario Replay Engine Routes ─────────────────────────────────────────────
router.get('/scenarios', getScenariosList);
router.get('/scenario-status', getScenarioStatus);
router.post('/run-scenario', authMiddleware, runScenario);
router.post('/stop-scenario', authMiddleware, stopScenario);

export default router;
