import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, AlertTriangle, ArrowLeft } from 'lucide-react';
import { API_BASE_URL } from '../config.js';

export default function EocLoginTerminal({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

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
        sessionStorage.setItem('sf_operator', json.operator?.username || username.trim());
        if (onLoginSuccess) {
          onLoginSuccess(json.token);
        }
      } else {
        setError(json.error || 'Invalid operator credentials.');
        triggerShake();
      }
    } catch {
      setError('Unable to reach the server. Please verify connection.');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{ maxWidth: '590px', width: '100%' }}
      className={`bg-[#0a1826] border border-white/15 rounded-2xl md:rounded-3xl shadow-[0_30px_70px_-15px_rgba(0,0,0,0.65)] overflow-hidden flex flex-col sm:flex-row card-enter relative z-[9999] mx-auto ${
        shake ? 'siren-shake' : ''
      }`}
    >
      {/* ── LEFT PANE: Blue Sidebar with Large Logo ── */}
      <div className="w-full sm:w-[210px] flex-shrink-0 bg-gradient-to-b from-[#123a54] to-[#0a2335] p-6 sm:p-8 flex flex-col items-center justify-center text-center border-b sm:border-b-0 sm:border-r border-white/10 text-white">
        <img
          src="/PUBMAT3.png"
          alt="SmartFlood Logo"
          className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover bg-white p-2 shadow-xl border border-white/30"
        />
        <h1 className="text-lg sm:text-xl font-bold font-display text-white mt-4 tracking-tight leading-snug">
          Smart Flood
        </h1>
        <p className="text-xs text-sky-200/80 font-medium mt-1">
          EOC Command Center
        </p>
      </div>

      {/* ── RIGHT PANE: Scaled Authentication Form ── */}
      <div className="flex-1 bg-white p-6 sm:p-8 flex flex-col justify-between text-slate-800 min-w-0">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#0c2333] tracking-tight font-display mb-1">
            Operator Access
          </h2>
          <p className="text-xs text-slate-500 mb-5">
            Sign in to access real-time telemetry and controls.
          </p>

          {/* Error Notice */}
          {error && (
            <div className="mb-4 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-2.5 text-red-700 text-xs font-medium">
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-red-600" />
              <span className="leading-tight">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label
                htmlFor="eoc-operator-username"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User size={15} />
                </div>
                <input
                  id="eoc-operator-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#123a54]/20 focus:border-[#123a54] transition shadow-inner font-sans"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="eoc-operator-password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock size={15} />
                </div>
                <input
                  id="eoc-operator-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-9 pr-11 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#123a54]/20 focus:border-[#123a54] transition shadow-inner font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 transition"
                  tabIndex={-1}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-[#0c2333] hover:bg-[#15344d] active:scale-[0.99] text-white font-semibold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Lock size={14} />
                  <span>Access Command Center</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Navigation */}
        <div className="pt-4 mt-5 border-t border-slate-100 flex items-center justify-between text-xs">
          <a
            href="/"
            className="text-slate-500 hover:text-slate-900 transition-colors inline-flex items-center gap-1.5 font-medium"
          >
            <ArrowLeft size={13} />
            <span>Return to Public Resident Portal</span>
          </a>
        </div>
      </div>
    </div>
  );
}
