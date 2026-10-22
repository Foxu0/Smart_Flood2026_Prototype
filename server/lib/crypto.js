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

// ── Board codes (printed on the board's sticker, also set in its firmware) ──
// 12 characters without look-alikes (no 0/O, 1/I), shown as XXXX-XXXX-XXXX.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateBoardCode() {
  const bytes = crypto.randomBytes(12);
  const chars = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

/** "7kq2 9xpm-h4td" → "7KQ29XPMH4TD", or null if it is not a valid board code. */
export function normalizeBoardCode(input) {
  const code = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return code.length === 12 && [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

/** Short lookup id so a reading can find its board without trying every hash. */
export function boardCodeLookup(normalizedCode) {
  return `bc_${crypto.createHash('sha256').update(normalizedCode).digest('hex').slice(0, 12)}`;
}
