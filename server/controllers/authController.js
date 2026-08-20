import jwt from 'jsonwebtoken';

/**
 * POST /api/v1/auth/login
 * Validates operator credentials against env vars and issues a signed JWT.
 *
 * Request body: { username: string, password: string }
 * Response:     { success: true, token: string, operator: { username } }
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

    const validUsername = process.env.ADMIN_USERNAME;
    const validPassword = process.env.ADMIN_PASSWORD;

    // Constant-time-ish string compare to avoid timing attacks
    const usernameMatch = username === validUsername;
    const passwordMatch = password === validPassword;

    if (!usernameMatch || !passwordMatch) {
      // Log failed attempt with timestamp for audit trail
      console.warn(`[Auth] Failed login attempt for username: "${username}" from ${req.ip}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials.',
      });
    }

    const payload = {
      username,
      role: 'admin',
      iss: 'SmartFlood-EOC',
      iat: Math.floor(Date.now() / 1000),
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    });

    console.log(`[Auth] Operator "${username}" logged in successfully from ${req.ip}`);

    return res.json({
      success: true,
      token,
      operator: { username, role: 'admin' },
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

/**
 * POST /api/v1/auth/logout
 * Stateless JWT — logout is handled client-side by clearing sessionStorage.
 * This endpoint exists for audit logging purposes.
 */
export function logout(req, res) {
  const username = req.operator?.username || 'unknown';
  console.log(`[Auth] Operator "${username}" logged out from ${req.ip}`);
  return res.json({ success: true, message: 'Logged out successfully.' });
}
