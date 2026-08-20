import { Navigate } from 'react-router-dom';

/**
 * ProtectedRoute — Guards /admin from unauthenticated access.
 * Reads the JWT from sessionStorage. If absent, redirects to /admin/login.
 * On tab close sessionStorage is cleared (24h JWT still valid for future logins).
 */
export default function ProtectedRoute({ children }) {
  const token = sessionStorage.getItem('sf_token');
  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}
