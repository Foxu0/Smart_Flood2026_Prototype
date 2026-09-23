import nodemailer from 'nodemailer';
import { prisma } from '../db.js';

// ── In-memory Cooldown Tracker ───────────────────────────────────────────────
// Prevents spamming subscribers with repeated emails if water level hovers around a threshold
const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes for same level
const lastBroadcastTimeByLevel = { 1: 0, 2: 0, 3: 0 };

let transporterCache = null;
let isEthereal = false;

/**
 * Lazily initialize and return a Nodemailer transporter.
 * If SMTP credentials are missing from .env, automatically creates an Ethereal test inbox.
 */
async function getTransporter() {
  if (transporterCache) return transporterCache;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporterCache = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: SMTP_SECURE === 'true',
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
    isEthereal = false;
    console.log(`[Email] Configured custom SMTP transporter (${SMTP_HOST}:${SMTP_PORT})`);
  } else {
    // Generate automatic Ethereal test account for local testing / zero config
    try {
      console.log('[Email] No SMTP credentials in .env — creating Ethereal test account for preview links...');
      const testAccount = await nodemailer.createTestAccount();
      transporterCache = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      isEthereal = true;
      console.log(`[Email] Ethereal test mailbox created: ${testAccount.user}`);
    } catch (err) {
      console.error('[Email] Failed to create Ethereal test account, using json transport mock:', err.message);
      transporterCache = nodemailer.createTransport({ jsonTransport: true });
      isEthereal = false;
    }
  }

  return transporterCache;
}

/**
 * Returns formatted Philippine Standard Time string
 */
function getFormattedPST() {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(new Date());
}

/**
 * Generates an aesthetic, responsive HTML email template for flood advisories.
 */
function generateAlertEmailHtml({
  level,
  title,
  message,
  waterLevelM,
  recipientName,
  unsubscribeUrl,
}) {
  const pstTime = getFormattedPST();
  const waterStr = Number(waterLevelM || 0).toFixed(2);

  // Level Theme Configuration
  const theme = {
    1: {
      badge: 'LEVEL 1: ADVISORY / WATCH',
      color: '#2563eb',
      bgLight: '#eff6ff',
      borderColor: '#93c5fd',
      headline: 'RIVER WATER LEVEL RISING — MONITOR CONDITIONS',
      instructions: [
        'Stay tuned to official CDRRMO weather advisories and barangay broadcasts.',
        'Clear nearby drainage inlets and secure outdoor loose items.',
        'Keep emergency battery packs and mobile devices charged.',
      ],
    },
    2: {
      badge: 'LEVEL 2: WARNING / ALARM',
      color: '#ea580c',
      bgLight: '#fff7ed',
      borderColor: '#fdba74',
      headline: 'FLOOD ALERT — PREPARE FOR EVACUATION',
      instructions: [
        'Prepare family Emergency Go-Bag (food, water, medicine, documents).',
        'Move electronics, appliances, and valuables to upper floors.',
        'Families with elderly, children, or PWDs should coordinate early evacuation.',
      ],
    },
    3: {
      badge: 'LEVEL 3: CRITICAL EMERGENCY / EVACUATION',
      color: '#dc2626',
      bgLight: '#fef2f2',
      borderColor: '#fca5a5',
      headline: 'CRITICAL DANGER: IMMEDIATE EVACUATION REQUIRED',
      instructions: [
        'EVACUATE IMMEDIATELY to your assigned Barangay Evacuation Center.',
        'Switch off main electrical breakers and LPG tanks before leaving.',
        'DO NOT attempt to drive or walk through flooded roadways or riverbanks.',
      ],
    },
  }[level] || {
    badge: `LEVEL ${level} ADVISORY`,
    color: '#0284c7',
    bgLight: '#f0f9ff',
    borderColor: '#7dd3fc',
    headline: title,
    instructions: ['Monitor official advisories.'],
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f1f5f9; padding:24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.06); border:1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color:#0f172a; padding:20px 24px; text-align:center;">
              <div style="color:#38bdf8; font-size:12px; font-weight:700; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:4px;">
                🌊 SmartFlood Early Warning Network
              </div>
              <h1 style="color:#ffffff; font-size:20px; font-weight:800; margin:0; letter-spacing:-0.3px;">
                Antipolo City River Basin Monitoring
              </h1>
              <div style="color:#94a3b8; font-size:12px; margin-top:4px;">
                Station: Mayamot River Basin • Antipolo, Rizal
              </div>
            </td>
          </tr>

          <!-- Alert Status Stripe -->
          <tr>
            <td style="background-color:${theme.color}; padding:14px 24px; text-align:center;">
              <span style="color:#ffffff; font-size:15px; font-weight:800; letter-spacing:1px; text-transform:uppercase;">
                ${theme.badge}
              </span>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:28px 24px;">
              ${recipientName ? `<p style="margin:0 0 12px 0; font-size:15px; color:#475569;">Kumusta, <strong>${recipientName}</strong>,</p>` : ''}
              
              <div style="background-color:${theme.bgLight}; border-left:4px solid ${theme.color}; border-radius:6px; padding:14px 16px; margin-bottom:24px;">
                <div style="font-size:16px; font-weight:700; color:${theme.color}; margin-bottom:4px;">
                  ${theme.headline}
                </div>
                <div style="font-size:14px; color:#334155; line-height:1.5;">
                  ${message}
                </div>
              </div>

              <!-- Real-time Telemetry Metrics Table -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px; background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
                <tr>
                  <td style="padding:16px; text-align:center;">
                    <div style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:600; letter-spacing:0.5px;">Current Water Level</div>
                    <div style="font-size:24px; font-weight:800; color:${theme.color}; margin-top:4px;">${waterStr} <span style="font-size:14px; font-weight:600;">meters</span></div>
                  </td>
                </tr>
              </table>

              <!-- Safety Instructions -->
              <div style="margin-bottom:24px;">
                <div style="font-size:14px; font-weight:700; color:#0f172a; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px;">
                  ⚠️ Recommended Action Steps:
                </div>
                <ul style="margin:0; padding-left:20px; font-size:14px; color:#334155; line-height:1.7;">
                  ${theme.instructions.map((ins) => `<li>${ins}</li>`).join('')}
                </ul>
              </div>

              <!-- Evacuation Hotlines -->
              <div style="background-color:#f1f5f9; border-radius:8px; padding:14px 18px; margin-bottom:20px;">
                <div style="font-size:13px; font-weight:700; color:#1e293b; margin-bottom:6px;">
                  📞 Antipolo Emergency Assistance Numbers:
                </div>
                <div style="font-size:13px; color:#475569; line-height:1.6;">
                  • <strong>Antipolo CDRRMO Operations Center:</strong> (02) 8696-9911<br>
                  • <strong>National Emergency Hotline:</strong> 911<br>
                  • <strong>Philippine Red Cross Rizal:</strong> (02) 8660-8451
                </div>
              </div>

              <div style="font-size:12px; color:#64748b; text-align:center; margin-top:20px;">
                Dispatched at: <strong>${pstTime}</strong> (PST)
              </div>
            </td>
          </tr>

          <!-- Footer with 1-Click Unsubscribe -->
          <tr>
            <td style="background-color:#f8fafc; border-top:1px solid #e2e8f0; padding:18px 24px; text-align:center; font-size:12px; color:#94a3b8;">
              <p style="margin:0 0 8px 0;">
                You are receiving this automated alert because you registered for SmartFlood Early Warning notifications in Antipolo City.
              </p>
              ${unsubscribeUrl ? `<a href="${unsubscribeUrl}" style="color:#64748b; text-decoration:underline;">Unsubscribe from flood email alerts</a>` : ''}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Dispatches flood alert emails to all eligible active subscribers.
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
}) {
  try {
    const now = Date.now();
    const lastSent = lastBroadcastTimeByLevel[level] || 0;
    const timeSinceLast = now - lastSent;

    // Cooldown check: bypass only if force=true or escalating to Level 3
    if (!force && level < 3 && timeSinceLast < COOLDOWN_MS) {
      const remainingMins = Math.ceil((COOLDOWN_MS - timeSinceLast) / 60000);
      console.log(`[Email] Alert for Level ${level} suppressed by cooldown (${remainingMins}m remaining).`);
      return { success: true, throttled: true, remainingMins };
    }

    // 1. Fetch eligible subscribers
    const subscribers = await prisma.emailSubscriber.findMany({
      where: {
        status: 'ACTIVE',
        minAlertLevel: { lte: level },
      },
    });

    if (subscribers.length === 0) {
      console.log(`[Email] No active subscribers registered for alert level ${level}+.`);
      return { success: true, count: 0, sent: 0, failed: 0 };
    }

    // 2. Record the AlertBroadcast entry in DB (linking to triggerLog if available)
    const broadcast = await prisma.alertBroadcast.create({
      data: {
        alertLevel: level,
        title: title || `SmartFlood Alert Level ${level}`,
        message: message || 'Flood advisory issued for Lower Antipolo.',
        waterLevelM: Number(waterLevelM || 0),
        rainfallRateMmh: 0,
        broadcastSource: source,
        triggerLogId: triggerLogId ? Number(triggerLogId) : null,
      },
    });

    // Update cooldown timestamp
    lastBroadcastTimeByLevel[level] = now;

    const transporter = await getTransporter();
    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
    const sender = process.env.SMTP_FROM || 'SmartFlood Alerts <alerts@smartflood.local>';

    console.log(`[Email] Dispatching Alert (Broadcast ID #${broadcast.id}, Level ${level}) to ${subscribers.length} subscriber(s)...`);

    // 3. Dispatch concurrently to all matching subscribers
    let sentCount = 0;
    let failedCount = 0;

    await Promise.allSettled(
      subscribers.map(async (sub) => {
        const unsubscribeUrl = `${appBaseUrl}/api/v1/subscribers/unsubscribe/${sub.unsubscribeToken}`;
        const emailHtml = generateAlertEmailHtml({
          level,
          title,
          message,
          waterLevelM,
          recipientName: sub.fullName,
          unsubscribeUrl,
        });

        const mailOptions = {
          from: sender,
          to: sub.email,
          subject: `⚠️ [SMARTFLOOD ALERT L${level}] ${title}`,
          html: emailHtml,
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
    };
  } catch (err) {
    console.error('[Email] Error in broadcastEmailAlert:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Sends a single test email to the specified address.
 */
export async function sendTestEmail({ toEmail, level = 2 }) {
  if (!toEmail) throw new Error('Recipient email is required.');

  const transporter = await getTransporter();
  const sender = process.env.SMTP_FROM || 'SmartFlood Alerts <alerts@smartflood.local>';
  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';

  const emailHtml = generateAlertEmailHtml({
    level,
    title: '🔔 SmartFlood System Test Alert',
    message: 'This is a test broadcast from the SmartFlood Early Warning System in Antipolo City. If you received this, your email notifications are properly configured.',
    waterLevelM: 1.48,
    recipientName: 'Valued Subscriber',
    unsubscribeUrl: `${appBaseUrl}/#email-alerts`,
  });

  const info = await transporter.sendMail({
    from: sender,
    to: toEmail,
    subject: `🔔 [SMARTFLOOD TEST L${level}] Test Early Warning Alert`,
    html: emailHtml,
  });

  const previewUrl = isEthereal ? nodemailer.getTestMessageUrl(info) : null;
  if (previewUrl) {
    console.log(`[Email][Test Preview URL]: ${previewUrl}`);
  }

  return {
    success: true,
    messageId: info.messageId,
    previewUrl,
    isEthereal,
  };
}
