import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, Send, Loader2, Sparkles } from 'lucide-react';
import { API_BASE_URL } from '../config.js';



export default function EmailSubscriptionCard({ onNotification }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [subscribedUser, setSubscribedUser] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Check localStorage for existing local subscription state
  useEffect(() => {
    try {
      const saved = localStorage.getItem('smartflood_email_sub');
      if (saved) {
        setSubscribedUser(JSON.parse(saved));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/subscribers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          fullName,
          minAlertLevel: 2,
          subscriberRole: 'RESIDENT',
        }),
      });


      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to register subscription.');
      }

      const userRecord = {
        email: data.data.email,
        fullName: data.data.fullName,
        barangay: data.data.barangay,
        minAlertLevel: data.data.minAlertLevel,
      };

      localStorage.setItem('smartflood_email_sub', JSON.stringify(userRecord));
      setSubscribedUser(userRecord);
      setSuccessMsg('Successfully subscribed! A confirmation alert was dispatched to your inbox.');
      if (onNotification) {
        onNotification({
          type: 'success',
          msg: `Subscribed ${email} to Flood Warning Alerts!`,
        });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Subscription failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestAlert = async () => {
    if (!subscribedUser?.email) return;
    setTesting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/subscribers/test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: subscribedUser.email,
          level: subscribedUser.minAlertLevel || 2,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send test email.');
      }

      setSuccessMsg(
        data.data?.isEthereal
          ? 'Test email generated! (Development Mode: Check server console for Ethereal preview link)'
          : `Test flood advisory email sent to ${subscribedUser.email}!`
      );
    } catch (err) {
      setErrorMsg(err.message || 'Failed to dispatch test email.');
    } finally {
      setTesting(false);
    }
  };

  const handleResetPreferences = () => {
    localStorage.removeItem('smartflood_email_sub');
    setSubscribedUser(null);
    setEmail('');
    setSuccessMsg('');
    setErrorMsg('');
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#e4edf0] p-4 sm:p-5 space-y-3.5 transition-all card-enter min-w-0 w-full overflow-hidden">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-[#f1f5f6] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#2b6e8f]/10 text-[#2b6e8f] flex items-center justify-center">
            <Mail size={15} />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[#123a54] leading-tight">
              Emergency Email Advisories
            </h3>
            <p className="text-[10px] text-[#6d818d]">Direct inbox alerts for Antipolo River Basin</p>
          </div>
        </div>
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#2f9463]/10 text-[#2f9463] border border-[#2f9463]/25">
          OFFICIAL FEED
        </span>
      </div>

      {subscribedUser ? (
        /* ── Active Subscription State ── */
        <div className="space-y-3 bg-[#f8fafc] rounded-xl p-3.5 border border-[#e2e8f0]">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 size={18} className="text-[#2f9463] flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#123a54] truncate">
                {subscribedUser.fullName ? `${subscribedUser.fullName} (${subscribedUser.email})` : subscribedUser.email}
              </p>
              <p className="text-[10px] text-[#6d818d] mt-0.5">
                Subscribed for Warning & Danger alerts (Level 2+)
              </p>
            </div>
          </div>

          <div className="text-[11px] text-[#475569] bg-white p-2.5 rounded-lg border border-[#eef2f3] space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-[#2f9463]">
              <Sparkles size={13} />
              <span>Email Delivery Active</span>
            </div>
            <p className="text-[10px] text-[#64748b]">
              You will automatically receive formatted flood warning emails whenever water levels cross your selected threshold.
            </p>
          </div>

          {successMsg && (
            <div className="text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg p-2 font-medium">
              {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="text-[11px] bg-red-50 text-red-700 border border-red-200 rounded-lg p-2 font-medium">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 flex-wrap sm:flex-nowrap">
            <button
              onClick={handleSendTestAlert}
              disabled={testing}
              className="flex-1 py-1.5 px-3 rounded-lg bg-[#2b6e8f] hover:bg-[#1f6f94] text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition shadow-xs disabled:opacity-60 cursor-pointer"
            >
              {testing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              <span>{testing ? 'Sending...' : 'Send Test Alert'}</span>
            </button>
            <button
              onClick={handleResetPreferences}
              className="py-1.5 px-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-medium transition cursor-pointer"
              title="Change email address or preferences"
            >
              Change
            </button>
          </div>
        </div>
      ) : (
        /* ── Registration Form State ── */
        <form onSubmit={handleSubscribe} className="space-y-3">
          <p className="text-[11px] text-[#6d818d] leading-relaxed">
            Get instant early warnings sent to your email when heavy rains elevate river levels near critical limits.
          </p>

          <div className="space-y-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6d818d] mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="name@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[#f8fafc] border border-[#d9e2ec] focus:outline-none focus:ring-2 focus:ring-[#2b6e8f] text-[#123a54] placeholder-gray-400"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6d818d] mb-1">
                Name (Optional)
              </label>
              <input
                type="text"
                placeholder="Juan Dela Cruz"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl bg-[#f8fafc] border border-[#d9e2ec] focus:outline-none focus:ring-2 focus:ring-[#2b6e8f] text-[#123a54] placeholder-gray-400"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="text-[11px] bg-red-50 text-red-700 border border-red-200 rounded-lg p-2 font-medium">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-3 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition hover:scale-[1.01] active:scale-98 disabled:opacity-60 cursor-pointer"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
            <span>{loading ? 'Registering...' : 'Subscribe to Emergency Alerts'}</span>
          </button>
        </form>
      )}
    </div>
  );
}
