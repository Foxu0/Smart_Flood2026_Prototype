import React, { useState } from 'react';
import EocLoginTerminal from './EocLoginTerminal.jsx';

/**
 * ProtectedRoute — Guards /admin from unauthenticated access.
 * Reads the JWT from sessionStorage. If valid, renders children.
 * If unauthenticated, renders children (AdminDashboard) covered by a steady
 * flood water overlay with a centered EOC terminal modal on top.
 */
export default function ProtectedRoute({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem('sf_token'));
  const [receding, setReceding] = useState(false);

  const handleLoginSuccess = (newToken) => {
    setReceding(true);
    setTimeout(() => {
      setToken(newToken);
    }, 700);
  };

  if (token) {
    return children;
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* ── Background: Covered Admin Dashboard ───────────────────────── */}
      <div className="pointer-events-none select-none filter blur-[2px] opacity-40">
        {children}
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


