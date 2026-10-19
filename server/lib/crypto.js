import crypto from 'crypto';

/**
 * Password + device-key hashing using Node's built-in scrypt (no extra deps).
 * Stored format: scrypt$<saltHex>$<hashHex>
 */
const KEY_LEN = 64;

export function hashSecret(secret) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(secret), salt, KEY_LEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifySecret(secret, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(String(secret), Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

/** A hash that no password can match (for accounts that must not log in). */
export function unusableHash() {
  return `disabled$${crypto.randomBytes(16).toString('hex')}`;
}

/** Device API key, shown to the operator exactly once: sfk_<prefix>_<secret> */
export function generateDeviceKey() {
  const prefix = crypto.randomBytes(4).toString('hex');
  const secret = crypto.randomBytes(24).toString('base64url');
  return { key: `sfk_${prefix}_${secret}`, prefix };
}

export function parseDeviceKeyPrefix(key) {
  const m = /^sfk_([0-9a-f]{8})_[A-Za-z0-9_-]+$/.exec(String(key || ''));
  return m ? m[1] : null;
}
