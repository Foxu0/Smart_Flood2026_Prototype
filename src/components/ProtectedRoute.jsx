import React, { useState } from 'react';
import { Shield, Eye, EyeOff, AlertTriangle, ArrowLeft, Lock } from 'lucide-react';
import { API_BASE_URL } from '../config.js';

/**
 * ProtectedRoute — Guards /admin from unauthenticated access.
 * Reads the JWT from sessionStorage. If valid, renders children.
 * If unauthenticated, renders children (AdminDashboard) covered by a steady
 * flood water overlay with a centered login modal pop-up on top.
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
        className="fixed inset-0 z-[9990] flex items-center justify-center p-4 transition-all duration-700 ease-in-out"
        style={{
          background: receding
            ? 'linear-gradient(180deg, rgba(26,85,117,0) 0%, rgba(18,58,84,0) 100%)'
            : 'linear-gradient(180deg, rgba(26,85,117,0.88) 0%, rgba(18,58,84,0.94) 40%, rgba(13,43,66,0.97) 100%)',
          backdropFilter: receding ? 'blur(0px)' : 'blur(8px)',
          transform: receding ? 'translateY(100%)' : 'translateY(0%)',
        }}
      >
        {/* Animated wave header inside overlay */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '200vw', pointerEvents: 'none', opacity: receding ? 0 : 0.6 }}>
          <div className="flood-wave-anim" style={{ animationDuration: '4s' }}>
            <svg viewBox="0 0 1440 80" style={{ width: '100vw', display: 'block', flexShrink: 0, height: 80 }} preserveAspectRatio="none">
              <path d="M0,40 C360,90 720,-10 1440,40 L1440,80 L0,80 Z" fill="rgba(127,196,224,0.3)" />
            </svg>
            <svg viewBox="0 0 1440 80" style={{ width: '100vw', display: 'block', flexShrink: 0, height: 80 }} preserveAspectRatio="none">
              <path d="M0,40 C360,90 720,-10 1440,40 L1440,80 L0,80 Z" fill="rgba(127,196,224,0.3)" />
            </svg>
          </div>
        </div>

        {/* ── Centered Login Modal Pop-up ────────────────────────────── */}
        {!receding && <AdminLoginModal onLoginSuccess={handleLoginSuccess} />}
      </div>
    </div>
  );
}

function AdminLoginModal({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [shake, setShake]       = useState(false);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      triggerShake();
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        sessionStorage.setItem('sf_token', json.token);
        sessionStorage.setItem('sf_operator', json.operator.username);
        onLoginSuccess(json.token);
      } else {
        setError(json.error || 'Invalid credentials. Please try again.');
        triggerShake();
      }
    } catch {
      setError('Cannot reach the SmartFlood API server. Is it running on port 3001?');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`relative z-[9999] bg-[#123a54] shadow-2xl rounded-[28px] border border-white/20 overflow-hidden card-enter ${shake ? 'siren-shake' : ''}`}
      style={{ width: '100%', maxWidth: '350px' }}
    >
      {/* Modal Header */}
      <header className="bg-gradient-to-r from-[#123a54] to-[#1f6f94] text-white p-5 text-center relative border-b border-white/10">
        <img
          src="/PUBMAT3.png"
          alt="PUBMAT 3 logo"
          className="w-12 h-12 rounded-full border-2 border-white/60 object-cover bg-white p-0.5 shadow-md mx-auto mb-2"
        />
        <h1 className="font-display text-xl font-bold leading-tight tracking-wide text-white">
          Smart Flood
        </h1>
        <p className="text-[11px] text-sky-100/90 mt-0.5 font-medium">
          EOC Command Center · Operator Access
        </p>

        <div className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-0.5 rounded-full bg-white/10 border border-white/20 text-[9px] text-amber-300 font-bold">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span>RESTRICTED EOC SYSTEM</span>
        </div>
      </header>

      {/* Modal Body */}
      <main className="bg-[#f4f7f8] p-5 space-y-4">
        <div className="bg-white rounded-2xl p-4 border border-[#e4edf0] shadow-sm space-y-3.5">

          {error && (
            <div className="flex items-start gap-2 bg-[#fce7e0] border border-[#f2bfab] rounded-xl p-2.5 text-[#e0522f] text-xs font-medium">
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3" autoComplete="off">
            <div>
              <label htmlFor="sf-username" className="text-[10px] font-bold uppercase tracking-wide text-[#6d818d] block mb-1">
                Operator Username
              </label>
              <input
                type="text"
                id="sf-username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter operator username"
                autoFocus
                className="w-full px-3 py-2 rounded-xl bg-[#fbfdfe] border border-[#dbe4de] text-[#123a54] placeholder-[#a0b0b9] text-xs focus:outline-none focus:border-[#2b6e8f] focus:ring-2 focus:ring-[#2b6e8f]/20 transition shadow-inner font-sans"
              />
            </div>

            <div>
              <label htmlFor="sf-password" className="text-[10px] font-bold uppercase tracking-wide text-[#6d818d] block mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  id="sf-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 pr-9 rounded-xl bg-[#fbfdfe] border border-[#dbe4de] text-[#123a54] placeholder-[#a0b0b9] text-xs focus:outline-none focus:border-[#2b6e8f] focus:ring-2 focus:ring-[#2b6e8f]/20 transition shadow-inner font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6d818d] hover:text-[#123a54] transition p-1"
                  title={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#123a54] to-[#1f6f94] hover:from-[#1f6f94] hover:to-[#2b6e8f] text-white font-bold text-xs shadow-md transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Authenticating...
                </>
              ) : (
                <><Lock size={14} /> Access Command Center</>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-[#f1f5f6] text-center">
            <a
              href="/"
              className="text-[11px] font-semibold text-[#6d818d] hover:text-[#123a54] transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowLeft size={13} />
              <span>Return to Public Resident Portal</span>
            </a>
          </div>
        </div>
      </main>

      <footer className="bg-gradient-to-r from-[#123a54] to-[#1f6f94] text-sky-200/90 text-center text-[10px] py-2.5 px-4 border-t border-white/10 font-semibold tracking-wide">
        <span>Smart Flood</span>
      </footer>
    </div>
  );
}

