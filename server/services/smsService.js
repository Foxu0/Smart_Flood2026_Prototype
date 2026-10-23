import crypto from 'crypto';
import { prisma } from '../db.js';

/**
 * SMS alerts for residents registered by Barangay staff / CDRRMO.
 *
 * Sending:
 *  - No SEMAPHORE_API_KEY in .env → SIMULATED: every text is saved in sms_logs (status SIMULATED)
 *    but nothing is actually sent. Used for the prototype/defense.
 *  - SEMAPHORE_API_KEY set → real texts through Semaphore (semaphore.co, a Philippine SMS service).
 *
 * Who gets a text: active residents in the barangay of the board that raised the alert.
 */
const SEMAPHORE_URL = 'https://api.semaphore.co/api/v4/messages';

export const smsMode = () => (process.env.SEMAPHORE_API_KEY ? 'SEMAPHORE' : 'SIMULATED');

/** Accepts 09171234567, 9171234567 or +639171234567 → returns 09171234567, or null if invalid. */
export function normalizePhone(input) {
  const digits = String(input || '').replace(/[^\d]/g, '');
  if (/^09\d{9}$/.test(digits)) return digits;
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^9\d{9}$/.test(digits)) return `0${digits}`;
  return null;
}

export async function listSmsResidents({ barangay } = {}) {
  return prisma.smsSubscriber.findMany({
    where: barangay ? { barangay } : {},
    orderBy: [{ barangay: 'asc' }, { fullName: 'asc' }],
  });
}

export async function addSmsResident({ fullName, phone, barangay }) {
  const number = normalizePhone(phone);
  if (!number) throw Object.assign(new Error('Enter a valid mobile number, e.g. 09171234567.'), { status: 400 });
  try {
    return await prisma.smsSubscriber.create({
      data: {
        fullName: fullName || null,
        phone: number,
        barangay,
        minAlertLevel: 1, // gets every alert level
        unsubscribeToken: crypto.randomUUID(),
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') throw Object.assign(new Error('This mobile number is already registered.'), { status: 409 });
    throw err;
  }
}

export async function findSmsResident(id) {
  return prisma.smsSubscriber.findUnique({ where: { id } });
}

export async function deleteSmsResident(id) {
  await prisma.smsLog.updateMany({ where: { subscriberId: id }, data: { subscriberId: null } });
  return prisma.smsSubscriber.delete({ where: { id } });
}

async function sendOne(phone, text) {
  if (smsMode() === 'SIMULATED') return { status: 'SIMULATED' };
  try {
    const res = await fetch(SEMAPHORE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        apikey: process.env.SEMAPHORE_API_KEY,
        number: phone,
        message: text,
        ...(process.env.SEMAPHORE_SENDER_NAME ? { sendername: process.env.SEMAPHORE_SENDER_NAME } : {}),
      }),
    });
    if (!res.ok) return { status: 'FAILED', error: `Semaphore HTTP ${res.status}` };
    return { status: 'SENT' };
  } catch (err) {
    return { status: 'FAILED', error: err.message };
  }
}

/**
 * Text the residents of the alerting board's barangay. Called right after an alert is recorded.
 * Returns how many texts were sent (or simulated).
 */
export async function sendSmsForAlert({ broadcastId, level, message, nodeId }) {
  try {
    const node = nodeId
      ? await prisma.hardwareNode.findUnique({ where: { id: nodeId }, select: { name: true, barangay: { select: { name: true } } } })
      : null;
    const barangay = node?.barangay?.name;
    if (!barangay) return 0; // no board → we don't know which barangay to text

    const residents = await prisma.smsSubscriber.findMany({
      where: { barangay, status: 'ACTIVE', minAlertLevel: { lte: level } },
    });
    if (residents.length === 0) return 0;

    // Keep it within one SMS (160 characters)
    const text = `SMART FLOOD Level ${level} (${node.name}): ${message}`.slice(0, 160);

    let count = 0;
    for (const r of residents) {
      const result = await sendOne(r.phone, text);
      await prisma.smsLog.create({
        data: {
          subscriberId: r.id,
          broadcastId,
          phone: r.phone,
          message: text,
          provider: smsMode(),
          status: result.status,
          errorMessage: result.error ?? null,
        },
      });
      if (result.status !== 'FAILED') count++;
    }
    console.log(`[SMS] Alert #${broadcastId}: ${count} text(s) ${smsMode() === 'SIMULATED' ? 'simulated' : 'sent'} to ${barangay}.`);
    return count;
  } catch (err) {
    console.error('[SMS] Failed to send alert texts:', err.message);
    return 0;
  }
}
