import { API_BASE_URL } from '../config.js';
import { STAFF_ROLES } from '../../shared/roles.js';

// Session lives in sessionStorage (cleared when the tab closes), same as before.
export function getToken() {
  return sessionStorage.getItem('sf_token') || '';
}

export function getUser() {
  try {
    return JSON.parse(sessionStorage.getItem('sf_user') || 'null');
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  sessionStorage.setItem('sf_token', token);
  sessionStorage.setItem('sf_user', JSON.stringify(user));
  sessionStorage.setItem('sf_operator', user?.username || ''); // legacy key read by older components
}

export function clearSession() {
  sessionStorage.removeItem('sf_token');
  sessionStorage.removeItem('sf_user');
  sessionStorage.removeItem('sf_operator');
}

/** Where a role lands after signing in (residents have no accounts → public dashboard) */
export function homePathFor(role) {
  return STAFF_ROLES.includes(role) ? '/admin' : '/';
}

/**
 * fetch wrapper for the SmartFlood API: adds the bearer token, parses JSON,
 * throws an Error with the server's message on failure, and clears the
 * session on 401/403 token errors.
 */
export async function api(path, { method = 'GET', body, ...rest } = {}) {
  const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json?.success === false) {
    if (res.status === 401 || ['TOKEN_EXPIRED', 'TOKEN_INVALID', 'ACCOUNT_INVALID'].includes(json?.code)) {
      clearSession();
      window.dispatchEvent(new Event('sf-session-expired'));
    }
    throw new Error(json?.error || `Request failed (HTTP ${res.status})`);
  }
  return json;
}
