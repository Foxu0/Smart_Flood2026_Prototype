import express from 'express';
import { prisma } from '../db.js';
import { sendWelcomeConfirmationEmail } from '../services/emailService.js';
import { requirePermission } from '../middleware/authMiddleware.js';
import { audit } from '../services/auditService.js';
import { BARANGAYS, BARANGAY_SCOPED_ROLES } from '../../shared/roles.js';
import { signupLimit } from '../middleware/signupLimit.js';
import { barangayHasStation } from '../services/deviceStore.js';

const router = express.Router();

// Email validation helper
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ── POST /api/v1/subscribers (Public Subscription) ───────────────────────────
router.post('/', signupLimit, async (req, res) => {
  try {
    const { email, fullName, barangay, minAlertLevel, subscriberRole } = req.body;

    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'A valid email address is required.' });
    }

    if (!BARANGAYS.includes(barangay)) {
      return res.status(400).json({ success: false, error: 'Choose your barangay.' });
    }
    if (!(await barangayHasStation(barangay))) {
      return res.status(400).json({ success: false, error: 'There is no flood station in your barangay yet.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName ? fullName.trim().slice(0, 100) : null;
    const cleanBarangay = barangay;
    const alertLevel = [1, 2, 3].includes(Number(minAlertLevel)) ? Number(minAlertLevel) : 1;
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

    // Dispatch welcome confirmation email asynchronously in background
    // Do NOT block the user's registration response waiting for SMTP/Ethereal network roundtrips
    setImmediate(async () => {
      try {
        await sendWelcomeConfirmationEmail({
          toEmail: cleanEmail,
          unsubscribeToken: subscriber.unsubscribeToken,
        });
      } catch (err) {
        console.warn(`[Subscribers] Background welcome email trigger notice:`, err.message);
      }
    });

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
        <head><title>Invalid Request — Smart Flood</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; text-align:center; padding:60px 20px; background:#f4f7f9; color:#123a54;">
          <div style="max-width:480px; margin:0 auto; background:#fff; padding:36px 24px; border-radius:20px; box-shadow:0 8px 24px rgba(18,58,84,0.06); border:1px solid #e4edf0;">
            <div style="display:inline-block; width:44px; height:44px; border-radius:50%; background:#fce7e0; color:#e0522f; line-height:44px; text-align:center; margin-bottom:12px;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e0522f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </div>
            <h2 style="margin:0 0 8px 0; color:#123a54; font-size:20px;">Invalid or Expired Link</h2>
            <p style="color:#6d818d; font-size:14px; line-height:1.5; margin:0 0 20px 0;">We could not find an active subscription associated with this security token.</p>
            <a href="/" style="display:inline-block; padding:10px 22px; background:#123a54; color:#fff; text-decoration:none; border-radius:10px; font-weight:600; font-size:13px;">Return to Smart Flood Portal</a>
          </div>
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
        <title>Unsubscribed — Smart Flood</title>
        <meta name="viewport" content="width=device-width,initial-scale=1">
      </head>
      <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; text-align:center; padding:60px 20px; background:#f4f7f9; color:#123a54;">
        <div style="max-width:500px; margin:0 auto; background:#fff; padding:36px 24px; border-radius:20px; box-shadow:0 8px 24px rgba(18,58,84,0.06); border:1px solid #e4edf0;">
          <div style="display:inline-block; width:44px; height:44px; border-radius:50%; background:#e5f6ec; color:#2f9463; line-height:44px; text-align:center; margin-bottom:12px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2f9463" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h2 style="margin:0 0 8px 0; color:#123a54; font-size:20px;">You Have Been Unsubscribed</h2>
          <p style="color:#6d818d; font-size:14px; line-height:1.5; margin:0 0 20px 0;">
            <strong style="color:#123a54;">${subscriber.email}</strong> will no longer receive emergency flood notifications from the Smart Flood Early Warning System.
          </p>
          <a href="/" style="display:inline-block; padding:10px 22px; background:#123a54; color:#fff; text-decoration:none; border-radius:10px; font-weight:600; font-size:13px;">Return to Smart Flood Portal</a>
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
// Staff only (residents' emails are personal data — RA 10173). Barangay staff see their barangay.
router.get('/', requirePermission('alerts.view'), async (req, res) => {
  try {
    const where = req.operator.role === 'BARANGAY' && req.operator.barangay ? { barangay: req.operator.barangay } : {};
    const subscribers = await prisma.emailSubscriber.findMany({
      where,
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

// Barangay staff only manage residents of their own barangay
const scopeBarangay = (req) => (BARANGAY_SCOPED_ROLES.includes(req.operator.role) ? req.operator.barangay : null);

// ── POST /api/v1/subscribers/manual (Staff adds a resident's email) ──────────
// Body: { fullName, email, barangay? }. The resident gets the welcome email with an unsubscribe link.
router.post('/manual', requirePermission('residents.manage'), async (req, res) => {
  try {
    const { email, fullName } = req.body || {};
    if (!isValidEmail(email)) return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
    const barangay = scopeBarangay(req) || req.body?.barangay;
    if (!BARANGAYS.includes(barangay)) return res.status(400).json({ success: false, error: 'Choose a barangay.' });

    const cleanEmail = email.trim().toLowerCase();
    if (await prisma.emailSubscriber.findUnique({ where: { email: cleanEmail } })) {
      return res.status(409).json({ success: false, error: 'This email is already on the list.' });
    }

    const subscriber = await prisma.emailSubscriber.create({
      data: {
        email: cleanEmail,
        fullName: fullName ? fullName.trim().slice(0, 100) : null,
        barangay,
        minAlertLevel: 1, // gets every alert level
        status: 'ACTIVE',
      },
    });
    audit(req.operator, 'subscriber.add', cleanEmail, { barangay });

    setImmediate(() => {
      sendWelcomeConfirmationEmail({ toEmail: cleanEmail, unsubscribeToken: subscriber.unsubscribeToken })
        .catch((err) => console.warn('[Subscribers] Welcome email notice:', err.message));
    });

    return res.status(201).json({ success: true, data: subscriber });
  } catch (err) {
    console.error('[POST /subscribers/manual] Error:', err);
    return res.status(500).json({ success: false, error: 'Could not add the email.' });
  }
});

// ── DELETE /api/v1/subscribers/:id (Staff removes a resident's email) ────────
router.delete('/:id', requirePermission('residents.manage'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid subscriber ID.' });
    }

    const found = await prisma.emailSubscriber.findUnique({ where: { id } });
    const scope = scopeBarangay(req);
    if (!found || (scope && found.barangay !== scope)) {
      return res.status(404).json({ success: false, error: 'Subscriber not found.' });
    }
    await prisma.emailDispatchLog.updateMany({ where: { subscriberId: id }, data: { subscriberId: null } }).catch(() => {});
    const removed = await prisma.emailSubscriber.delete({
      where: { id },
    });
    audit(req.operator, 'subscriber.delete', removed.email);

    return res.json({ success: true, message: 'Subscriber deleted successfully.' });
  } catch (err) {
    console.error('[DELETE /subscribers/:id] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete subscriber', detail: err.message });
  }
});

// ── GET /api/v1/subscribers/broadcasts (Broadcast History) ────────────────────
router.get('/broadcasts', requirePermission('alerts.view'), async (req, res) => {
  try {
    // Barangay staff only see alerts from their own barangay's boards
    const scope = scopeBarangay(req);
    const broadcasts = await prisma.alertBroadcast.findMany({
      where: scope ? { node: { barangay: { name: scope } } } : {},
      take: 20,
      orderBy: { triggeredAt: 'desc' },
      include: {
        node: { select: { name: true } },
        _count: {
          select: { dispatchLogs: true, smsLogs: true },
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
