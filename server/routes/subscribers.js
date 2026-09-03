import express from 'express';
import { prisma } from '../db.js';
import { broadcastEmailAlert, sendTestEmail } from '../services/emailService.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Email validation helper
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ── POST /api/v1/subscribers (Public Subscription) ───────────────────────────
router.post('/', async (req, res) => {
  try {
    const { email, fullName, barangay, minAlertLevel, subscriberRole } = req.body;

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'A valid email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName ? fullName.trim().slice(0, 100) : null;
    const cleanBarangay = barangay ? barangay.trim().slice(0, 80) : 'Mayamot';
    const alertLevel = [1, 2, 3].includes(Number(minAlertLevel)) ? Number(minAlertLevel) : 2;
    const role = ['RESIDENT', 'OFFICIAL', 'RESPONDER'].includes(subscriberRole) ? subscriberRole : 'RESIDENT';

    // Upsert to handle reactivations or updates
    const existing = await prisma.emailSubscriber.findUnique({
      where: { email: cleanEmail },
    });

    let subscriber;
    if (existing) {
      subscriber = await prisma.emailSubscriber.update({
        where: { email: cleanEmail },
        data: {
          fullName: cleanName || existing.fullName,
          barangay: cleanBarangay || existing.barangay,
          minAlertLevel: alertLevel,
          subscriberRole: role,
          status: 'ACTIVE', // Reactivate if was UNSUBSCRIBED
        },
      });
    } else {
      subscriber = await prisma.emailSubscriber.create({
        data: {
          email: cleanEmail,
          fullName: cleanName,
          barangay: cleanBarangay,
          minAlertLevel: alertLevel,
          subscriberRole: role,
          status: 'ACTIVE',
        },
      });
    }

    // Send a welcome / test confirmation email in background
    sendTestEmail({ toEmail: cleanEmail, level: alertLevel }).catch((err) =>
      console.warn(`[Subscribers] Welcome email trigger notice:`, err.message)
    );

    return res.status(201).json({
      success: true,
      message: 'Successfully subscribed to SmartFlood Emergency Email Alerts!',
      data: subscriber,
    });
  } catch (err) {
    console.error('[POST /subscribers] Error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error', detail: err.message });
  }
});

// ── GET /api/v1/subscribers/unsubscribe/:token (1-Click Unsubscribe) ────────
router.get('/unsubscribe/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const subscriber = await prisma.emailSubscriber.findUnique({
      where: { unsubscribeToken: token },
    });

    if (!subscriber) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Invalid Request</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="font-family:sans-serif; text-align:center; padding:50px 20px; background:#f8fafc; color:#1e293b;">
          <h2>⚠️ Invalid or Expired Link</h2>
          <p>We could not find an active subscription associated with this link.</p>
          <a href="/" style="display:inline-block; margin-top:16px; padding:10px 20px; background:#0284c7; color:#fff; text-decoration:none; border-radius:6px;">Return to SmartFlood Portal</a>
        </body>
        </html>
      `);
    }

    await prisma.emailSubscriber.update({
      where: { id: subscriber.id },
      data: { status: 'UNSUBSCRIBED' },
    });

    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribed — SmartFlood</title>
        <meta name="viewport" content="width=device-width,initial-scale=1">
      </head>
      <body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif; text-align:center; padding:60px 20px; background:#f8fafc; color:#1e293b;">
        <div style="max-width:500px; margin:0 auto; background:#fff; padding:36px; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.06); border:1px solid #e2e8f0;">
          <div style="font-size:40px; margin-bottom:12px;">✅</div>
          <h2 style="margin:0 0 8px 0; color:#0f172a;">You have been unsubscribed</h2>
          <p style="color:#64748b; font-size:15px; line-height:1.5;">
            <strong>${subscriber.email}</strong> will no longer receive flood warning emails from the SmartFlood Antipolo Early Warning Network.
          </p>
          <a href="/" style="display:inline-block; margin-top:20px; padding:10px 24px; background:#0f172a; color:#fff; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px;">Return to Live Portal</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('[GET /unsubscribe] Error:', err);
    return res.status(500).send('An unexpected error occurred while processing your request.');
  }
});

// ── GET /api/v1/subscribers (Admin Listing + Stats) ──────────────────────────
router.get('/', async (req, res) => {
  try {
    const subscribers = await prisma.emailSubscriber.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        barangay: true,
        subscriberRole: true,
        minAlertLevel: true,
        status: true,
        createdAt: true,
        _count: {
          select: { dispatchLogs: true },
        },
      },
    });

    const total = subscribers.length;
    const active = subscribers.filter((s) => s.status === 'ACTIVE').length;
    const unsubscribed = subscribers.filter((s) => s.status === 'UNSUBSCRIBED').length;

    // Barangay distribution
    const byBarangay = subscribers.reduce((acc, sub) => {
      acc[sub.barangay] = (acc[sub.barangay] || 0) + 1;
      return acc;
    }, {});

    return res.json({
      success: true,
      stats: { total, active, unsubscribed, byBarangay },
      subscribers,
    });
  } catch (err) {
    console.error('[GET /subscribers] Error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error', detail: err.message });
  }
});

// ── DELETE /api/v1/subscribers/:id (Admin Deletion) ──────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid subscriber ID.' });
    }

    await prisma.emailSubscriber.delete({
      where: { id },
    });

    return res.json({ success: true, message: 'Subscriber deleted successfully.' });
  } catch (err) {
    console.error('[DELETE /subscribers/:id] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete subscriber', detail: err.message });
  }
});

// ── POST /api/v1/subscribers/test-email (Admin Test Email) ───────────────────
router.post('/test-email', async (req, res) => {
  try {
    const { toEmail, level } = req.body;
    if (!toEmail || !isValidEmail(toEmail)) {
      return res.status(400).json({ success: false, error: 'Valid recipient email is required.' });
    }

    const result = await sendTestEmail({
      toEmail: toEmail.trim(),
      level: Number(level) || 2,
    });

    return res.json({
      success: true,
      message: 'Test email successfully dispatched!',
      data: result,
    });
  } catch (err) {
    console.error('[POST /subscribers/test-email] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to send test email', detail: err.message });
  }
});

// ── POST /api/v1/subscribers/broadcast (Manual Admin Broadcast) ──────────────
router.post('/broadcast', authMiddleware, async (req, res) => {
  try {
    const { title, message, level = 2, waterLevelM = 1.5, force = true } = req.body;

    const result = await broadcastEmailAlert({
      title: title || '⚠️ MANUAL FLOOD ADVISORY',
      message: message || 'CDRRMO Operator initiated emergency advisory.',
      level: Number(level),
      waterLevelM: Number(waterLevelM),
      source: 'MANUAL_OPERATOR',
      force: Boolean(force),
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[POST /subscribers/broadcast] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to broadcast email alert', detail: err.message });
  }
});

// ── GET /api/v1/subscribers/broadcasts (Broadcast History) ────────────────────
router.get('/broadcasts', async (req, res) => {
  try {
    const broadcasts = await prisma.alertBroadcast.findMany({
      take: 20,
      orderBy: { triggeredAt: 'desc' },
      include: {
        _count: {
          select: { dispatchLogs: true },
        },
      },
    });

    return res.json({ success: true, broadcasts });
  } catch (err) {
    console.error('[GET /subscribers/broadcasts] Error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error', detail: err.message });
  }
});

export default router;
