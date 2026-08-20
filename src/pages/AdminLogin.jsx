import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Wifi, AlertTriangle, ArrowLeft, Lock } from 'lucide-react';
import { API_BASE_URL } from '../config.js';

export default function AdminLogin() {
  const navigate = useNavigate();
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
        navigate('/admin', { replace: true });
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
    <div className="min-h-screen w-full font-sans text-[#3f5361] py-6 px-4 flex flex-col justify-center items-center">

      {/* Main compact card matching dashboard styling exactly */}
      <div
        className={`bg-[#123a54] backdrop-blur-xl shadow-2xl rounded-[28px] border border-white/10 overflow-hidden card-enter ${shake ? 'siren-shake' : ''}`}
        style={{ width: '100%', maxWidth: '340px' }}
      >

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <header className="bg-gradient-to-r from-[#123a54] to-[#1f6f94] text-white p-6 sm:p-7 text-center relative border-b border-white/10">
          <img
            src="/PUBMAT3.png"
            alt="PUBMAT 3 logo"
            className="w-14 h-14 rounded-full border-2 border-white/60 object-cover bg-white p-0.5 shadow-md mx-auto mb-3"
          />
          <h1 className="font-display text-xl sm:text-2xl font-bold leading-tight tracking-wide text-white">
            Smart Flood
          </h1>
          <p className="text-xs text-sky-100/90 mt-1 font-medium">
            EOC Command Center · Operator Access
          </p>

          <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[10px] text-amber-300 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>RESTRICTED EOC SYSTEM</span>
          </div>
        </header>

        {/* ── BODY ───────────────────────────────────────────────────────── */}
        <main className="bg-[#f4f7f8] p-5 sm:p-6 space-y-4">

          {/* Inner clean white card container */}
          <div className="bg-white rounded-2xl p-5 border border-[#e4edf0] shadow-sm space-y-4">

            {/* Error Banner */}
            {error && (
              <div className="flex items-start gap-2.5 bg-[#fce7e0] border border-[#f2bfab] rounded-xl p-3 text-[#e0522f] text-xs font-medium">
                <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
              <div>
                <label htmlFor="sf-username" className="text-[10px] font-bold uppercase tracking-wide text-[#6d818d] block mb-1.5">
                  Operator Username
                </label>
                <input
                  type="text"
                  id="sf-username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter operator username"
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#fbfdfe] border border-[#dbe4de] text-[#123a54] placeholder-[#a0b0b9] text-sm focus:outline-none focus:border-[#2b6e8f] focus:ring-2 focus:ring-[#2b6e8f]/20 transition shadow-inner font-sans"
                />
              </div>

              <div>
                <label htmlFor="sf-password" className="text-[10px] font-bold uppercase tracking-wide text-[#6d818d] block mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    id="sf-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2.5 pr-11 rounded-xl bg-[#fbfdfe] border border-[#dbe4de] text-[#123a54] placeholder-[#a0b0b9] text-sm focus:outline-none focus:border-[#2b6e8f] focus:ring-2 focus:ring-[#2b6e8f]/20 transition shadow-inner font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6d818d] hover:text-[#123a54] transition p-1"
                    title={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#123a54] to-[#1f6f94] hover:from-[#1f6f94] hover:to-[#2b6e8f] text-white font-bold text-xs shadow-md transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <><RefreshIcon /> Authenticating Operator...</>
                ) : (
                  <><Lock size={14} /> Access EOC Command Center</>
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

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <footer className="bg-gradient-to-r from-[#123a54] to-[#1f6f94] text-sky-200/90 text-center text-[10px] py-3 px-4 border-t border-white/10 font-semibold tracking-wide">
          <span>Smart Flood</span>
        </footer>

      </div>
    </div>
  );
}

function RefreshIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
