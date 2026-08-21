import express from 'express';
import { getVapidPublicKey, saveSubscription, broadcastPushAlert } from '../services/webpushService.js';

const router = express.Router();

// ── GET /api/v1/notifications/vapid-public-key ─────────────────────────────
// Exposes the VAPID Public Key for browser PushManager.subscribe() requests
router.get('/vapid-public-key', (req, res) => {
  try {
    const publicKey = getVapidPublicKey();
    res.json({ success: true, publicKey });
  } catch (err) {
    console.error('[GET /notifications/vapid-public-key]', err);
    res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
});

// ── POST /api/v1/notifications/subscribe ────────────────────────────────────
// Saves or updates a browser Web Push subscription in PostgreSQL
router.post('/subscribe', async (req, res) => {
  try {
    const subscription = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({
        error: 'Invalid subscription payload. Must include endpoint and keys (p256dh, auth).',
      });
    }

    const saved = await saveSubscription(subscription);
    res.status(201).json({ success: true, message: 'Push subscription registered successfully', data: saved });
  } catch (err) {
    console.error('[POST /notifications/subscribe]', err);
    res.status(500).json({ error: 'Failed to save push subscription', detail: err.message });
  }
});

// ── POST /api/v1/notifications/test ──────────────────────────────────────────
// Debug endpoint to trigger a test Web Push notification
router.post('/test', async (req, res) => {
  try {
    const { title, body } = req.body;
    const result = await broadcastPushAlert({
      title: title || '🔔 SmartFlood Test Notification',
      body:  body  || 'Web Push Notifications are working! You will receive live flood alerts here.',
      level: 1,
      url:   '/',
    });
    res.json(result);
  } catch (err) {
    console.error('[POST /notifications/test]', err);
    res.status(500).json({ error: 'Failed to send test push notification', detail: err.message });
  }
});

export default router;
