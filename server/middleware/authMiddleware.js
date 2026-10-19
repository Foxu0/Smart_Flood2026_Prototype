import jwt from 'jsonwebtoken';
import { can } from '../../shared/roles.js';

/**
 * authMiddleware — Verifies Bearer JWT on protected routes.
 * Rejects with 401 if no token, 403 if token is invalid or expired.
 * Attaches the decoded payload ({ sub, username, role, barangay }) as req.operator.
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized — No token provided. Please log in at /admin/login.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.operator = decoded; // attach decoded payload to request
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden — Session expired. Please log in again.',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(403).json({
      success: false,
      error: 'Forbidden — Invalid token.',
      code: 'TOKEN_INVALID',
    });
  }
}

/**
 * requirePermission — authMiddleware + permission check from shared/roles.js.
 * Usage: router.post('/', requirePermission('thresholds.manage'), handler)
 */
export function requirePermission(permission) {
  return [
    authMiddleware,
    (req, res, next) => {
      if (can(req.operator?.role, permission)) return next();
      return res.status(403).json({
        success: false,
        error: `Forbidden — your role (${req.operator?.role || 'unknown'}) cannot perform this action.`,
        code: 'INSUFFICIENT_ROLE',
      });
    },
  ];
}
