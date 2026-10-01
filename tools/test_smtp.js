/**
 * Standalone SMTP diagnostic — run with:
 *   node tools/test_smtp.js
 */
import nodemailer from 'nodemailer';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env manually (no dotenv dependency needed) ─────────────────────────
const envPath = resolve(__dirname, '../.env');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => {
      const eqIdx = l.indexOf('=');
      return [l.slice(0, eqIdx).trim(), l.slice(eqIdx + 1).trim().replace(/^"|"$/g, '')];
    })
    .filter(([k]) => k)
);

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = envVars;

console.log('\n── SmartFlood SMTP Diagnostic ──────────────────────────');
console.log(`  Host  : ${SMTP_HOST}`);
console.log(`  Port  : ${SMTP_PORT}`);
console.log(`  User  : ${SMTP_USER}`);
console.log(`  Pass  : ${'*'.repeat((SMTP_PASS || '').length)} (${(SMTP_PASS || '').length} chars)`);
console.log(`  From  : ${SMTP_FROM}`);
console.log('────────────────────────────────────────────────────────\n');

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.error('MISSING SMTP credentials in .env — aborting.');
  process.exit(1);
}

const isGmail = SMTP_HOST.toLowerCase().includes('gmail');
const transporter = nodemailer.createTransport(
  isGmail
    ? {
        service: 'gmail',
        auth: {
          user: SMTP_USER.trim(),
          pass: SMTP_PASS.replace(/\s+/g, ''),
        },
      }
    : {
        host: SMTP_HOST.trim(),
        port: Number(SMTP_PORT) || 587,
        secure: Number(SMTP_PORT) === 465,
        auth: {
          user: SMTP_USER.trim(),
          pass: SMTP_PASS.trim(),
        },
      }
);

console.log('Verifying SMTP connection...');
try {
  await transporter.verify();
  console.log('SUCCESS: SMTP connection verified!\n');
} catch (err) {
  console.error('FAILED: SMTP connection error:');
  console.error(`  Code   : ${err.code}`);
  console.error(`  Message: ${err.message}`);
  if (err.code === 'EAUTH') {
    console.error('\nFix: Gmail App Password may be wrong or 2FA is not enabled.');
    console.error('  Go to: https://myaccount.google.com/apppasswords');
    console.error('  Generate a new App Password for "Mail"');
  }
  process.exit(1);
}

console.log(`Sending test email to ${SMTP_USER}...`);
try {
  const info = await transporter.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: SMTP_USER,
    subject: '[SmartFlood] SMTP Test — Diagnostic',
    html: `<p>SMTP is working correctly for SmartFlood. Sent at ${new Date().toISOString()}</p>`,
  });
  console.log(`Email sent! Message ID: ${info.messageId}`);
  console.log('\nEverything looks good — restart the SmartFlood server and emails should work.\n');
} catch (err) {
  console.error('sendMail FAILED:');
  console.error(`  ${err.message}`);
}
