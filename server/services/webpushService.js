import webpush from 'web-push';
import { prisma } from '../db.js';

// Default VAPID keypair (overridable via process.env)
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  || 'BOOHWLt437kEXWqlhEmL-MmVpebbENz5gc4rtdrVfqQl852vp6vRx5ODHVi0_L_-OFPbPV9XN5myzuEZ7Mmtfv8';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '1p2E6UzV7fyAkOUZfwOd5w_1SnUrERrNz4zxgpvOpCU';
const VAPID_SUBJECT     = process.env.VAPID_CONTACT_EMAIL || 'mailto:admin@smartflood.local';

// Initialize web-push details
webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

console.log('[WebPush] VAPID push notification engine initialized');

/**
 * Returns the public VAPID key for frontend browser subscription requests
 */
export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}

/**
 * Saves or updates a browser Web Push subscription in PostgreSQL.
 *
 * @param {object} subscription - { endpoint, keys: { p256dh, auth } }
 * @returns {Promise<object>}
 */
export async function saveSubscription(subscription) {
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    throw new Error('Invalid Web Push subscription format');
  }

  const { endpoint, keys } = subscription;
  const p256dh = keys.p256dh;
  const auth   = keys.auth;

  if (!p256dh || !auth) {
    throw new Error('Missing subscription keys (p256dh or auth)');
  }

  // Upsert subscription into PostgreSQL
  const saved = await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh, auth },
    create: { endpoint, p256dh, auth },
  });

  console.log(`[WebPush] Subscription saved (id:${saved.id}, endpoint: ${endpoint.slice(-20)})`);
  return saved;
}

/**
 * Broadcasts a high-priority Web Push Notification to all active browser subscribers.
 * Automatically removes invalid or expired subscriptions (410 Gone / 404 Not Found).
 *
 * @param {object} options
 * @param {string} options.title - Notification title
 * @param {string} options.body  - Notification message body
 * @param {number} [options.level] - Flood alert level (e.g. 2 for Warning, 3 for Emergency)
 * @param {string} [options.url]   - Destination URL when notification is clicked
 */
export async function broadcastPushAlert({ title, body, level = 2, url = '/' }) {
  try {
    const subscriptions = await prisma.pushSubscription.findMany();
    if (subscriptions.length === 0) {
      console.log('[WebPush] No active push subscribers to notify.');
      return { success: true, count: 0, sent: 0, failed: 0 };
    }

    const payload = JSON.stringify({
      title: title || '🌊 SMART FLOOD ALERT',
      body:  body  || 'Flood threshold breached in Lower Antipolo. Monitor situation.',
      level,
      url,
      timestamp: new Date().toISOString(),
    });

    console.log(`[WebPush] Dispatching push alert "${title}" to ${subscriptions.length} subscriber(s)...`);

    // Dispatch to all subscribers concurrently
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth:   sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payload);
          return { id: sub.id, status: 'fulfilled' };
        } catch (err) {
          const statusCode = err.statusCode || err.status;
          // If subscription is expired (410 Gone or 404 Not Found), purge from DB
          if (statusCode === 410 || statusCode === 404) {
            console.log(`[WebPush] Removing expired subscription (id:${sub.id}, code:${statusCode})`);
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          }
          throw err;
        }
      })
    );

    const sent   = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(`[WebPush] Push alert broadcast complete: ${sent} sent, ${failed} failed.`);
    return { success: true, total: subscriptions.length, sent, failed };
  } catch (err) {
    console.error('[WebPush] Error during broadcastPushAlert:', err.message);
    return { success: false, error: err.message };
  }
}
