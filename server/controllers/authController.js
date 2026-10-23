import jwt from 'jsonwebtoken';
import { verifyLogin, findUserById, toPublicUser } from '../services/accountStore.js';
import { barangayNameById } from '../services/barangayStore.js';
import { audit } from '../services/auditService.js';

async function issueToken(user) {
  const payload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    barangay: await barangayNameById(user.barangayId),
    iss: 'SmartFlood-EOC',
  };
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });
}

async function sessionResponse(user) {
  return {
    success: true,
    token: await issueToken(user),
    operator: await toPublicUser(user),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  };
}

/**
 * POST /api/v1/auth/login
 * Validates credentials against the account store and issues a signed JWT
 * carrying the user's role and barangay.
 *
 * Request body: { username: string, password: string }
 * Response:     { success: true, token, operator: { id, username, role, barangay, ... } }
 */
export async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required.',
      });
    }

    const user = await verifyLogin(String(username).trim(), String(password));
    if (!user) {
      // Log failed attempt with timestamp for audit trail
      console.warn(`[Auth] Failed login attempt for username: "${username}" from ${req.ip}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials.',
      });
    }

    console.log(`[Auth] ${user.role} "${user.username}" logged in successfully from ${req.ip}`);
    audit({ sub: user.id, username: user.username, role: user.role }, 'auth.login');

    return res.json(await sessionResponse(user));
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

/** GET /api/v1/auth/me — current account profile */
export async function me(req, res) {
  const user = req.operator?.sub ? await findUserById(req.operator.sub) : null;
  if (!user || user.status !== 'ACTIVE') {
    return res.status(401).json({ success: false, error: 'Account not found or disabled.', code: 'ACCOUNT_INVALID' });
  }
  return res.json({ success: true, operator: await toPublicUser(user) });
}

/**
 * POST /api/v1/auth/logout
 * Stateless JWT — logout is handled client-side by clearing sessionStorage.
 * This endpoint exists for audit logging purposes.
 */
export function logout(req, res) {
  const username = req.operator?.username || 'unknown';
  console.log(`[Auth] Operator "${username}" logged out from ${req.ip}`);
  audit(req.operator, 'auth.logout');
  return res.json({ success: true, message: 'Logged out successfully.' });
}
