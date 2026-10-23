import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import EocLoginTerminal from './EocLoginTerminal.jsx';
import { getToken, getUser, homePathFor } from '../lib/session.js';

/**
 * ProtectedRoute — Guards a console route by role.
 *   roles    — roles allowed on this route (from shared/roles.js)
 *   backdrop — element shown blurred behind the login overlay
 * Signed-in users with a different role are redirected to their own home.
 * Unauthenticated visitors get the flood-water overlay with the login terminal.
 */
export default function ProtectedRoute({ roles, backdrop = null, children }) {
  const navigate = useNavigate();
  const [session, setSessionState] = useState(() => ({ token: getToken(), user: getUser() }));
  const [receding, setReceding] = useState(false);

  useEffect(() => {
    const onExpired = () => { setReceding(false); setSessionState({ token: '', user: null }); };
    window.addEventListener('sf-session-expired', onExpired);
    return () => window.removeEventListener('sf-session-expired', onExpired);
  }, []);

  const handleLoginSuccess = (newToken, operator) => {
    if (!roles.includes(operator?.role)) {
      navigate(homePathFor(operator?.role), { replace: true });
      return;
    }
    setReceding(true);
    setTimeout(() => {
      setSessionState({ token: newToken, user: operator });
    }, 700);
  };

  // Tokens issued before role-based accounts have no stored user → force re-login
  if (session.token && session.user) {
    if (roles.includes(session.user.role)) return children;
    return <Navigate to={homePathFor(session.user.role)} replace />;
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* ── Background: Covered Admin Dashboard ───────────────────────── */}
      <div className="pointer-events-none select-none filter blur-[2px] opacity-40">
        {backdrop}
      </div>

      {/* ── Steady Flood Overlay (Water covering background view) ─────── */}
      <div
        className="fixed inset-0 z-[9990] flex items-center justify-center p-3 sm:p-6 transition-all duration-700 ease-in-out overflow-y-auto overflow-x-hidden"
        style={{
          background: receding
            ? 'linear-gradient(180deg, rgba(26,85,117,0) 0%, rgba(18,58,84,0) 100%)'
            : 'linear-gradient(180deg, rgba(10,25,38,0.92) 0%, rgba(13,38,58,0.96) 50%, rgba(7,18,28,0.98) 100%)',
          backdropFilter: receding ? 'blur(0px)' : 'blur(12px)',
          transform: receding ? 'translateY(100%)' : 'translateY(0%)',
        }}
      >
        {/* Animated wave header inside overlay */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', overflow: 'hidden', pointerEvents: 'none', opacity: receding ? 0 : 0.4 }}>
          <div className="flood-wave-anim" style={{ animationDuration: '6s' }}>
            <svg viewBox="0 0 1440 80" style={{ width: '100vw', display: 'block', flexShrink: 0, height: 80 }} preserveAspectRatio="none">
              <path d="M0,40 C360,90 720,-10 1440,40 L1440,80 L0,80 Z" fill="rgba(127,196,224,0.15)" />
            </svg>
            <svg viewBox="0 0 1440 80" style={{ width: '100vw', display: 'block', flexShrink: 0, height: 80 }} preserveAspectRatio="none">
              <path d="M0,40 C360,90 720,-10 1440,40 L1440,80 L0,80 Z" fill="rgba(127,196,224,0.15)" />
            </svg>
          </div>
        </div>

        {/* ── Centered EOC Terminal ──────────────────────────────────── */}
        {!receding && (
          <div className="relative z-10 w-full flex justify-center py-4 my-auto">
            <EocLoginTerminal onLoginSuccess={handleLoginSuccess} />
          </div>
        )}
      </div>
    </div>
  );
}


