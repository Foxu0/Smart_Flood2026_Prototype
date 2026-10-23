import nodemailer from 'nodemailer';
import { prisma } from '../db.js';
import { sendSmsForAlert } from './smsService.js';
import { generateAlertEmailHtml, generateWelcomeEmailHtml, getLogoAttachment, stripEmojis } from './emailTemplates.js';

// ── In-memory Cooldown Tracker ───────────────────────────────────────────────
// Prevents spamming subscribers with repeated emails if water level hovers around a threshold
const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes for same level
const lastBroadcastTime = {}; // key: "<board id>:<level>" so one board's alert doesn't block another's

let transporterCache = null;
let isEthereal = false;

/**
 * Clears the cached SMTP transporter so it is re-created on the next send.
 * Call this after updating SMTP credentials at runtime.
 */
export function resetTransporter() {
  transporterCache = null;
  isEthereal = false;
  console.log('[Email] Transporter cache cleared — will reinitialise on next send.');
}

/**
 * Lazily initialize and return a Nodemailer transporter.
 * If SMTP credentials are missing from .env, automatically creates an Ethereal test inbox.
 */
async function getTransporter() {
  if (transporterCache) return transporterCache;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    const isGmail = SMTP_HOST.toLowerCase().includes('gmail');
    transporterCache = nodemailer.createTransport(
      isGmail
        ? {
            service: 'gmail',
            connectionTimeout: 5000,
            greetingTimeout: 5000,
            socketTimeout: 10000,
            auth: {
              user: SMTP_USER.trim(),
              pass: SMTP_PASS.replace(/\s+/g, ''),
            },
          }
        : {
            host: SMTP_HOST.trim(),
            port: Number(SMTP_PORT) || 587,
            secure: SMTP_SECURE === 'true' || Number(SMTP_PORT) === 465,
            connectionTimeout: 5000,
            greetingTimeout: 5000,
            socketTimeout: 10000,
            auth: {
              user: SMTP_USER.trim(),
              pass: SMTP_PASS.trim(),
            },
          }
    );
    isEthereal = false;
    console.log(`[Email] Configured SMTP transporter (${isGmail ? 'Gmail Service' : `${SMTP_HOST}:${SMTP_PORT}`}) with user ${SMTP_USER}`);
  } else {
    try {
      console.log('[Email] No SMTP credentials in .env — creating Ethereal test account (with 3s timeout)...');
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Ethereal account creation timed out after 3s')), 3000)
      );
      const testAccount = await Promise.race([nodemailer.createTestAccount(), timeoutPromise]);
      transporterCache = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        connectionTimeout: 4000,
        greetingTimeout: 4000,
        socketTimeout: 6000,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      isEthereal = true;
      console.log(`[Email] Ethereal test mailbox created: ${testAccount.user}`);
    } catch (err) {
      console.warn('[Email] Falling back to instant JSON mock transporter:', err.message);
      transporterCache = nodemailer.createTransport({ jsonTransport: true });
      isEthereal = false;
    }
  }

  return transporterCache;
}

/**
 * Sends flood alert emails to active subscribers in the alerting board's barangay (SMS follows the same rule).
 * Enforces cooldown throttling so fluctuating sensor readings don't spam recipients.
 */
export async function broadcastEmailAlert({
  title,
  message,
  level = 2,
  waterLevelM = 0,
  source = 'AUTOMATED_SENSOR',
  force = false,
  triggerLogId = null,
  nodeId = null,
}) {
  try {
    const now = Date.now();
    const cooldownKey = `${nodeId ?? 'none'}:${level}`;
    const lastSent = lastBroadcastTime[cooldownKey] || 0;
    const timeSinceLast = now - lastSent;

    // Cooldown check: bypass only if force=true or escalating to Level 3
    if (!force && level < 3 && timeSinceLast < COOLDOWN_MS) {
      const remainingMins = Math.ceil((COOLDOWN_MS - timeSinceLast) / 60000);
      console.log(`[Email] Alert for Level ${level} suppressed by cooldown (${remainingMins}m remaining).`);
      return { success: true, throttled: true, remainingMins };
    }

    // 1. Only residents registered in the barangay of the board that raised the alert
    const node = nodeId
      ? await prisma.hardwareNode.findUnique({ where: { id: Number(nodeId) }, select: { barangay: { select: { name: true } } } })
      : null;
    const barangay = node?.barangay?.name;
    const subscribers = barangay
      ? await prisma.emailSubscriber.findMany({
          where: { barangay, status: 'ACTIVE', minAlertLevel: { lte: level } },
        })
      : [];

    const defaultTitle =
      level === 1
        ? 'Water Level Rising'
        : level === 2
        ? 'Flood Warning Active'
        : 'Spill Level Reached';

    const cleanTitle = stripEmojis(title || defaultTitle) || defaultTitle;
    const cleanMessage = stripEmojis(message || 'Flood advisory issued for monitored river basin.');

    // 2. Record the AlertBroadcast entry in DB (linking to triggerLog if available)
    const broadcast = await prisma.alertBroadcast.create({
      data: {
        alertLevel: level,
        title: cleanTitle,
        message: cleanMessage,
        waterLevelM: Number(waterLevelM || 0),
        rainfallRateMmh: 0,
        broadcastSource: source,
        triggerLogId: triggerLogId ? Number(triggerLogId) : null,
        nodeId: nodeId ? Number(nodeId) : null, // which board raised it (kept even if readings are deleted)
      },
    });

    // Update cooldown timestamp
    lastBroadcastTime[cooldownKey] = now;

    // Text the residents of the board's barangay (simulated unless SEMAPHORE_API_KEY is set)
    const smsSent = await sendSmsForAlert({ broadcastId: broadcast.id, level, message: cleanMessage, nodeId: nodeId ? Number(nodeId) : null });

    if (subscribers.length === 0) {
      console.log(`[Email] No email subscribers in ${barangay || 'this board\'s barangay'} for level ${level}.`);
      return { success: true, broadcastId: broadcast.id, count: 0, sent: 0, failed: 0, smsSent };
    }

    const transporter = await getTransporter();
    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
    const sender = process.env.SMTP_FROM || 'SmartFlood Alerts <alerts@smartflood.local>';

    console.log(`[Email] Dispatching Alert (Broadcast ID #${broadcast.id}, Level ${level}) to ${subscribers.length} subscriber(s)...`);

    // Clean, emoji-free subject line matching our web portal
    const cleanSubject = `[Smart Flood] ${cleanTitle}`;
    const attachments = getLogoAttachment();

    // 3. Dispatch concurrently to all matching subscribers
    let sentCount = 0;
    let failedCount = 0;

    await Promise.allSettled(
      subscribers.map(async (sub) => {
        const unsubscribeUrl = `${appBaseUrl}/api/v1/subscribers/unsubscribe/${sub.unsubscribeToken}`;
        const emailHtml = generateAlertEmailHtml({
          level,
          title: cleanTitle,
          message: cleanMessage,
          waterLevelM,
          recipientName: sub.fullName,
          unsubscribeUrl,
        });

        const mailOptions = {
          from: sender,
          to: sub.email,
          subject: cleanSubject,
          html: emailHtml,
          attachments,
        };

        try {
          const info = await transporter.sendMail(mailOptions);
          sentCount++;

          if (isEthereal && nodemailer.getTestMessageUrl(info)) {
            console.log(`[Email][Ethereal Preview] ${sub.email} -> ${nodemailer.getTestMessageUrl(info)}`);
          }

          // Record successful dispatch log
          await prisma.emailDispatchLog.create({
            data: {
              broadcastId: broadcast.id,
              subscriberId: sub.id,
              recipientEmail: sub.email,
              subject: mailOptions.subject,
              status: 'SENT',
              sentAt: new Date(),
            },
          });
        } catch (err) {
          failedCount++;
          console.error(`[Email] Failed delivery to ${sub.email}:`, err.message);

          // Record failed dispatch log
          await prisma.emailDispatchLog.create({
            data: {
              broadcastId: broadcast.id,
              subscriberId: sub.id,
              recipientEmail: sub.email,
              subject: mailOptions.subject,
              status: 'FAILED',
              errorMessage: err.message,
            },
          });
        }
      })
    );

    console.log(`[Email] Alert broadcast completed: ${sentCount} sent, ${failedCount} failed.`);
    return {
      success: true,
      broadcastId: broadcast.id,
      total: subscribers.length,
      sent: sentCount,
      failed: failedCount,
      smsSent,
    };
  } catch (err) {
    console.error('[Email] Error in broadcastEmailAlert:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Sends a welcome confirmation email immediately upon registration with clean formatting.
 */
export async function sendWelcomeConfirmationEmail({ toEmail, unsubscribeToken }) {
  if (!toEmail) throw new Error('Recipient email is required.');

  const transporter = await getTransporter();
  const sender = process.env.SMTP_FROM || 'SmartFlood Alerts <alerts@smartflood.local>';
  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
  const unsubscribeUrl = unsubscribeToken
    ? `${appBaseUrl}/api/v1/subscribers/unsubscribe/${unsubscribeToken}`
    : `${appBaseUrl}/#email-alerts`;

  const emailHtml = generateWelcomeEmailHtml({
    recipientEmail: toEmail,
    unsubscribeUrl,
  });

  const info = await transporter.sendMail({
    from: sender,
    to: toEmail,
    subject: '[Smart Flood] Subscription Confirmed - Early Flood Warning System',
    html: emailHtml,
    attachments: getLogoAttachment(),
  });

  const previewUrl = isEthereal ? nodemailer.getTestMessageUrl(info) : null;
  if (previewUrl) {
    console.log(`[Email][Welcome Preview URL (Ethereal)]: ${previewUrl}`);
  } else {
    console.log(`[Email] Successfully dispatched welcome email to ${toEmail} (Message ID: ${info.messageId})`);
  }

  return {
    success: true,
    messageId: info.messageId,
    previewUrl,
    isEthereal,
  };
}

