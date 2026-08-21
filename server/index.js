import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { initWebSocketServer } from './websocket.js';
import telemetryRouter from './routes/telemetry.js';
import eventsRouter from './routes/events.js';
import controlRouter from './routes/control.js';
import settingsRouter from './routes/settings.js';
import weatherRouter from './routes/weather.js';
import { startWeatherPoller } from './services/weatherService.js';
import { startRetentionScheduler } from './services/retentionService.js';
import { login, logout } from './controllers/authController.js';
import { authMiddleware } from './middleware/authMiddleware.js';

const app = express();
const PORT = process.env.PORT || process.env.API_PORT || 3001;

// ── Middleware ──────────────────────────────────────────────────────────────
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, Render health checks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o))) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Request Logger ──────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  const ts = new Date().toLocaleTimeString('en-PH', { hour12: false });
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// ── Auth Routes (public — issues JWT) ──────────────────────────────────────
app.post('/api/v1/auth/login', login);
app.post('/api/v1/auth/logout', authMiddleware, logout);

// ── REST Routes ─────────────────────────────────────────────────────────────
app.use('/api/v1/telemetry', telemetryRouter);
app.use('/api/v1/events', eventsRouter);
app.use('/api/v1/control', controlRouter);
app.use('/api/v1/settings', settingsRouter);
app.use('/api/v1/weather', weatherRouter);

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/v1/health', (_req, res) => {
  res.json({
    status: 'OK',
    service: 'SmartFlood API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Error Handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

// ── HTTP + WebSocket Server ───────────────────────────────────────────────────
const server = http.createServer(app);
initWebSocketServer(server);

// Start automated weather poller (fetches every 10 mins)
startWeatherPoller();

// Start automated data retention scheduler (daily purge of logs > 30 days)
startRetentionScheduler(parseInt(process.env.DATA_RETENTION_DAYS || '30'));

server.listen(PORT, () => {
  console.log(`\n🌊 SmartFlood API Server running`);
  console.log(`   REST     → http://localhost:${PORT}/api/v1`);
  console.log(`   Auth     → POST http://localhost:${PORT}/api/v1/auth/login`);
  console.log(`   Weather  → http://localhost:${PORT}/api/v1/weather`);
  console.log(`   WS       → ws://localhost:${PORT}`);
  console.log(`   Health   → http://localhost:${PORT}/api/v1/health\n`);
});

export default app;
