import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// HTML for the two emails Smart Flood sends: the flood alert and the welcome email.
// emailService.js decides who gets them and when; this file only builds the content.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGO_PATH = path.resolve(__dirname, '../../public/PUBMAT3.png');
const PUBLIC_LOGO_URL = 'https://raw.githubusercontent.com/Foxu0/Smart_Flood2026_Prototype/main/public/PUBMAT3.png';

export function getLogoAttachment() {
  if (fs.existsSync(LOGO_PATH)) {
    return [
      {
        filename: 'PUBMAT3.png',
        path: LOGO_PATH,
        cid: 'smartflood-logo',
        contentDisposition: 'inline',
      },
    ];
  }
  return [];
}

function getLogoSrc() {
  return fs.existsSync(LOGO_PATH) ? 'cid:smartflood-logo' : PUBLIC_LOGO_URL;
}

export function stripEmojis(str = '') {
  return String(str || '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
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
 * Generates an elegant, responsive HTML email matching the exact Smart Flood web portal design.
 * Strictly NO emojis. All visual cues use clean SVG vector icons and web-tailored tokens.
 */
export function generateAlertEmailHtml({
  level,
  title,
  message,
  waterLevelM,
  recipientName,
  unsubscribeUrl,
  baseUrl = process.env.APP_BASE_URL || 'http://localhost:5173',
}) {
  const pstTime = getFormattedPST();
  const waterNum = Number(waterLevelM || 0);
  const waterStr = waterNum.toFixed(2);

  // Mirror web design tokens from PublicPortal.jsx
  const THEMES = {
    1: {
      badge: 'Level 1: Advisory',
      statusPill: 'Advisory · Water Rising',
      color: '#2b6e8f',
      soft: '#e6f2f8',
      border: '#bfdbe8',
      heroTitle: 'Water Level Rising',
      heroMsg: 'Rainfall has increased upstream water levels. The river channel is slightly elevated but remains within monitored advisory limits.',
      actionTitle: 'Precautionary Steps',
      actionBadge: 'Advisory Stage',
      actions: [
        'Charge mobile phones, emergency power banks, and flashlights.',
        'Move valuable belongings, documents, and electronics away from ground level.',
        'Stay tuned to official CDRRMO weather advisories and barangay broadcasts.',
      ],
      forecast30m: (waterNum + 0.12).toFixed(2),
      forecast60m: (waterNum + 0.22).toFixed(2),
      waterBarPct: Math.min(100, Math.max(15, Math.round((waterNum / 2.4) * 100))),
      forecastBarPct: Math.min(100, Math.max(20, Math.round(((waterNum + 0.12) / 2.4) * 100))),
    },
    2: {
      badge: 'Level 2: Warning',
      statusPill: 'Watch Closely · Warning Active',
      color: '#e69138',
      soft: '#fdf1de',
      border: '#f4d6a4',
      heroTitle: 'Flood Warning Active',
      heroMsg: 'Water levels are approaching critical warning thresholds. Prepare emergency go-bags and stay prepared for potential evacuation orders.',
      actionTitle: 'Urgent Preparedness Actions',
      actionBadge: 'Warning Active',
      actions: [
        'Pack family Emergency Go-Bags with clean water, ready food, and maintenance medicine.',
        'Disconnect non-essential electrical appliances from wall sockets.',
        'Families with elderly, children, or PWDs should prepare for early evacuation transfer.',
      ],
      forecast30m: (waterNum + 0.16).toFixed(2),
      forecast60m: (waterNum + 0.28).toFixed(2),
      waterBarPct: Math.min(100, Math.max(25, Math.round((waterNum / 2.4) * 100))),
      forecastBarPct: Math.min(100, Math.max(35, Math.round(((waterNum + 0.16) / 2.4) * 100))),
    },
    3: {
      badge: 'Level 3: Danger',
      statusPill: 'CRITICAL · DANGER LEVEL',
      color: '#e0522f',
      soft: '#fce7e0',
      border: '#f2bfab',
      heroTitle: 'Danger Level Reached',
      heroMsg: 'Water levels have reached critical danger thresholds. Please move immediately to designated high-ground evacuation shelters.',
      actionTitle: 'Critical Danger Actions',
      actionBadge: 'Danger Level',
      actions: [
        'Evacuate immediately — proceed safely to your assigned Barangay Evacuation Center.',
        'Switch off main electrical breakers and LPG gas valves before leaving.',
        'Do NOT walk, swim, or drive through flooded roads or overflowing river channels.',
      ],
      forecast30m: (waterNum + 0.20).toFixed(2),
      forecast60m: (waterNum + 0.35).toFixed(2),
      waterBarPct: Math.min(100, Math.max(40, Math.round((waterNum / 2.4) * 100))),
      forecastBarPct: Math.min(100, Math.max(50, Math.round(((waterNum + 0.20) / 2.4) * 100))),
    },
  };

  const t = THEMES[level] || THEMES[1];
  const displayTitle = stripEmojis(title || t.heroTitle) || t.heroTitle;
  const displayMsg = stripEmojis(message || t.heroMsg) || t.heroMsg;
  const logoSrc = getLogoSrc();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${displayTitle}</title>
  <style type="text/css">
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f4f7f9; }
    @media only screen and (max-width: 600px) {
      .email-wrapper { width: 100% !important; padding: 12px 8px !important; }
      .stat-cell { display: block !important; width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; margin-bottom: 10px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f4f7f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#3f5361;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f7f9; padding:28px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" class="email-wrapper" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:580px; background-color:#ffffff; border-radius:20px; overflow:hidden; border:1px solid #e4edf0; box-shadow:0 8px 24px rgba(18,58,84,0.06);">
          
          <!-- Web-Matching Navy Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #123a54 0%, #1f6f94 100%); padding:22px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="46" valign="middle" style="padding-right:12px;">
                    <img src="${logoSrc}" alt="Smart Flood Logo" width="40" height="40" style="display:block; width:40px; height:40px; border-radius:50%; border:2px solid rgba(255,255,255,0.7); background-color:#ffffff; padding:1px; object-fit:cover;" />
                  </td>
                  <td valign="middle">
                    <div style="color:#ffffff; font-size:19px; font-weight:800; letter-spacing:0.3px; line-height:1.2;">
                      Smart Flood
                    </div>
                    <div style="color:#bae6fd; font-size:11px; font-weight:600; letter-spacing:0.2px; margin-top:2px;">
                      Public Resident Portal · Real-Time Flood Monitoring &amp; Safety
                    </div>
                  </td>
                  <td align="right" valign="middle">
                    <div style="background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.2); padding:4px 10px; border-radius:12px; color:#ffffff; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">
                      Antipolo CDRRMO
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content Area -->
          <tr>
            <td style="padding:24px 22px;">
              ${recipientName ? `<p style="margin:0 0 14px 0; font-size:14px; color:#123a54; font-weight:600;">Attention: <strong>${stripEmojis(recipientName)}</strong>,</p>` : ''}

              <!-- Hero Status Advisory Card (Matches PublicPortal.jsx) -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, ${t.soft} 0%, #ffffff 85%); border:1px solid ${t.border}; border-radius:16px; margin-bottom:16px;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:8px;">
                      <tr>
                        <td valign="middle">
                          <span style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:${t.color};">
                            Resident Status Advisory
                          </span>
                        </td>
                        <td align="right" valign="middle">
                          <span style="display:inline-block; background:${t.color}; color:#ffffff; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.6px; padding:3px 10px; border-radius:12px;">
                            ${t.statusPill}
                          </span>
                        </td>
                      </tr>
                    </table>

                    <div style="font-size:21px; font-weight:800; color:#123a54; line-height:1.25; margin:8px 0 6px 0;">
                      ${displayTitle}
                    </div>
                    <div style="font-size:13px; color:#3f5361; line-height:1.55; margin-bottom:14px;">
                      ${displayMsg}
                    </div>

                    <div style="font-size:11px; color:#6d818d; border-top:1px solid rgba(0,0,0,0.05); padding-top:10px;">
                      Dispatched: <strong>${pstTime}</strong> · Real-Time Sensor Telemetry
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Safety Guidance Box (Matches Web Numbered Action Boxes) -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff; border:1px solid #e4edf0; border-radius:16px; padding:16px 18px; margin-bottom:16px;">
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:12px; border-bottom:1px solid #f1f5f6; padding-bottom:8px;">
                      <tr>
                        <td valign="middle">
                          <span style="font-size:13px; font-weight:700; color:#123a54;">${t.actionTitle}</span>
                        </td>
                        <td align="right" valign="middle">
                          <span style="background:${t.soft}; color:${t.color}; font-size:10px; font-weight:700; padding:2px 8px; border-radius:10px;">
                            ${t.actionBadge}
                          </span>
                        </td>
                      </tr>
                    </table>

                    <!-- Numbered list items -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      ${t.actions
                        .map(
                          (act, idx) => `
                      <tr>
                        <td style="padding:4px 0;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fbfdfe; border:1px solid #eef2f3; border-radius:10px; padding:10px 12px;">
                            <tr>
                              <td width="26" valign="top">
                                <div style="width:20px; height:20px; border-radius:50%; background:rgba(18,58,84,0.08); color:#123a54; font-size:11px; font-weight:700; text-align:center; line-height:20px;">
                                  ${idx + 1}
                                </div>
                              </td>
                              <td valign="middle" style="font-size:13px; color:#3f5361; line-height:1.5;">
                                ${act}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>`
                        )
                        .join('')}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Verified Emergency Hotlines (Clean Web Card) -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fbfdfe; border:1px solid #e4edf0; border-radius:16px; padding:16px 18px;">
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:10px;">
                      <tr>
                        <td valign="middle">
                          <span style="font-size:13px; font-weight:700; color:#123a54;">Verified Emergency Hotlines</span>
                        </td>
                        <td align="right" valign="middle">
                          <span style="font-size:10px; font-weight:600; color:#6d818d;">Antipolo CDRRMO · 24/7</span>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding:6px 0; border-bottom:1px solid #f1f5f6;">
                          <div style="font-size:12px; font-weight:700; color:#123a54;">Antipolo CDRRMO Operations Center</div>
                          <div style="font-size:12px; color:#2b6e8f; font-weight:600; margin-top:1px;">(02) 8689-4564 &nbsp;·&nbsp; 0927-755-9911</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0; border-bottom:1px solid #f1f5f6;">
                          <div style="font-size:12px; font-weight:700; color:#123a54;">National Emergency Line</div>
                          <div style="font-size:12px; color:#2b6e8f; font-weight:600; margin-top:1px;">911 (Toll-Free Nationwide)</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">
                          <div style="font-size:12px; font-weight:700; color:#123a54;">Philippine Red Cross (Rizal Chapter)</div>
                          <div style="font-size:12px; color:#2b6e8f; font-weight:600; margin-top:1px;">143 &nbsp;·&nbsp; (02) 8635-0922</div>
                        </td>
                      </tr>
                    </table>

                    <div style="font-size:10px; color:#94a3b8; margin-top:8px; border-top:1px dashed #e2e8f0; padding-top:6px;">
                      Source: City Government of Antipolo Official Emergency Directory (antipolo.ph)
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Web-Matching Clean Footer -->
          <tr>
            <td style="background-color:#f8fafc; border-top:1px solid #e4edf0; padding:18px 24px; text-align:center; font-size:11px; color:#6d818d; line-height:1.6;">
              <div style="font-weight:600; color:#475569;">
                Smart Flood Antipolo · Real-Time Flood Monitoring &amp; Early Warning System
              </div>
              ${unsubscribeUrl ? `<div style="margin-top:6px;">Don't want these emails? <a href="${unsubscribeUrl}" style="color:#2b6e8f; text-decoration:underline;">Unsubscribe</a></div>` : ''}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates an aesthetic, responsive HTML email template for subscription confirmation.
 * Strictly NO emojis and NO decorative icons.
 */
export function generateWelcomeEmailHtml({ recipientEmail, unsubscribeUrl, baseUrl = process.env.APP_BASE_URL || 'http://localhost:5173' }) {
  const pstTime = getFormattedPST();
  const logoSrc = getLogoSrc();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Smart Flood Subscription Confirmed</title>
  <style type="text/css">
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f4f7f9; }
    @media only screen and (max-width: 600px) {
      .email-wrapper { width: 100% !important; padding: 12px 8px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f4f7f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#3f5361;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f7f9; padding:28px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" class="email-wrapper" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:580px; background-color:#ffffff; border-radius:20px; overflow:hidden; border:1px solid #e4edf0; box-shadow:0 8px 24px rgba(18,58,84,0.06);">
          
          <!-- Web-Matching Navy Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #123a54 0%, #1f6f94 100%); padding:22px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="46" valign="middle" style="padding-right:12px;">
                    <img src="${logoSrc}" alt="Smart Flood Logo" width="40" height="40" style="display:block; width:40px; height:40px; border-radius:50%; border:2px solid rgba(255,255,255,0.7); background-color:#ffffff; padding:1px; object-fit:cover;" />
                  </td>
                  <td valign="middle">
                    <div style="color:#ffffff; font-size:19px; font-weight:800; letter-spacing:0.3px; line-height:1.2;">
                      Smart Flood
                    </div>
                    <div style="color:#bae6fd; font-size:11px; font-weight:600; letter-spacing:0.2px; margin-top:2px;">
                      Public Resident Portal · Real-Time Flood Monitoring &amp; Safety
                    </div>
                  </td>
                  <td align="right" valign="middle">
                    <div style="background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.2); padding:4px 10px; border-radius:12px; color:#ffffff; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">
                      Antipolo CDRRMO
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Area -->
          <tr>
            <td style="padding:24px 22px;">

              <!-- Hero Status Confirmation Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(135deg, #e5f6ec 0%, #ffffff 85%); border:1px solid #bfe6cf; border-radius:16px; margin-bottom:16px;">
                <tr>
                  <td style="padding:22px; text-align:center;">
                    <div style="font-size:20px; font-weight:800; color:#123a54; line-height:1.2; margin-bottom:6px;">
                      Subscription Confirmed
                    </div>
                    <div style="font-size:13px; color:#3f5361; line-height:1.55; max-width:440px; margin:0 auto 12px auto;">
                      Your email is registered for real-time automated emergency flood alerts from the Smart Flood monitoring network.
                    </div>
                    <div style="display:inline-block; background:#2f9463; color:#ffffff; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.6px; padding:3px 12px; border-radius:12px;">
                      Active Resident Subscriber
                    </div>
                  </td>
                </tr>
              </table>

              <!-- What to Expect Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff; border:1px solid #e4edf0; border-radius:16px; padding:16px 18px; margin-bottom:16px;">
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:12px; border-bottom:1px solid #f1f5f6; padding-bottom:8px;">
                      <tr>
                        <td valign="middle">
                          <span style="font-size:13px; font-weight:700; color:#123a54;">What You Will Receive</span>
                        </td>
                      </tr>
                    </table>

                    <!-- Feature items -->
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding:4px 0;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fbfdfe; border:1px solid #eef2f3; border-radius:10px; padding:10px 12px;">
                            <tr>
                              <td width="26" valign="top">
                                <div style="width:20px; height:20px; border-radius:50%; background:rgba(47,148,99,0.15); color:#2f9463; font-size:11px; font-weight:700; text-align:center; line-height:20px;">
                                  1
                                </div>
                              </td>
                              <td valign="middle" style="font-size:12px; color:#3f5361; line-height:1.5;">
                                <strong>Early Stage Warnings:</strong> Instant alert notification when water levels exceed safe riverbank limits.
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fbfdfe; border:1px solid #eef2f3; border-radius:10px; padding:10px 12px;">
                            <tr>
                              <td width="26" valign="top">
                                <div style="width:20px; height:20px; border-radius:50%; background:rgba(230,145,56,0.15); color:#e69138; font-size:11px; font-weight:700; text-align:center; line-height:20px;">
                                  2
                                </div>
                              </td>
                              <td valign="middle" style="font-size:12px; color:#3f5361; line-height:1.5;">
                                <strong>AI Trend Projections:</strong> Forecasted stage height (+30m &amp; +60m) powered by the SmartFlood LSTM model.
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fbfdfe; border:1px solid #eef2f3; border-radius:10px; padding:10px 12px;">
                            <tr>
                              <td width="26" valign="top">
                                <div style="width:20px; height:20px; border-radius:50%; background:rgba(43,110,143,0.15); color:#2b6e8f; font-size:11px; font-weight:700; text-align:center; line-height:20px;">
                                  3
                                </div>
                              </td>
                              <td valign="middle" style="font-size:12px; color:#3f5361; line-height:1.5;">
                                <strong>Evacuation Guidance:</strong> Verified evacuation center locations and 24/7 official CDRRMO hotlines.
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Verified Emergency Hotlines -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fbfdfe; border:1px solid #e4edf0; border-radius:16px; padding:16px 18px;">
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:10px;">
                      <tr>
                        <td valign="middle">
                          <span style="font-size:13px; font-weight:700; color:#123a54;">24/7 Emergency Hotlines</span>
                        </td>
                        <td align="right" valign="middle">
                          <span style="font-size:10px; font-weight:600; color:#6d818d;">Antipolo CDRRMO</span>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="padding:6px 0; border-bottom:1px solid #f1f5f6;">
                          <div style="font-size:12px; font-weight:700; color:#123a54;">Antipolo CDRRMO Operations Center</div>
                          <div style="font-size:12px; color:#2b6e8f; font-weight:600; margin-top:1px;">(02) 8689-4564 &nbsp;·&nbsp; 0927-755-9911</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0; border-bottom:1px solid #f1f5f6;">
                          <div style="font-size:12px; font-weight:700; color:#123a54;">National Emergency Line</div>
                          <div style="font-size:12px; color:#2b6e8f; font-weight:600; margin-top:1px;">911 (Toll-Free Nationwide)</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">
                          <div style="font-size:12px; font-weight:700; color:#123a54;">Philippine Red Cross (Rizal Chapter)</div>
                          <div style="font-size:12px; color:#2b6e8f; font-weight:600; margin-top:1px;">143 &nbsp;·&nbsp; (02) 8635-0922</div>
                        </td>
                      </tr>
                    </table>

                    <div style="font-size:10px; color:#94a3b8; margin-top:8px; border-top:1px dashed #e2e8f0; padding-top:6px;">
                      Registered: <strong>${pstTime}</strong> (PST)
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Web-Matching Clean Footer -->
          <tr>
            <td style="background-color:#f8fafc; border-top:1px solid #e4edf0; padding:18px 24px; text-align:center; font-size:11px; color:#6d818d; line-height:1.6;">
              <div style="font-weight:600; color:#475569;">
                Smart Flood Antipolo · Real-Time Flood Monitoring &amp; Early Warning System
              </div>
              ${unsubscribeUrl ? `<div style="margin-top:6px;">Don't want these emails? <a href="${unsubscribeUrl}" style="color:#2b6e8f; text-decoration:underline;">Unsubscribe</a></div>` : ''}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
