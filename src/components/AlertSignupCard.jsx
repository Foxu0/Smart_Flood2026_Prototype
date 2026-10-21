import React, { useState } from 'react';
import { Bell, CheckCircle2, Loader2, MessageSquare, Mail } from 'lucide-react';
import { API_BASE_URL } from '../config.js';
import { BARANGAYS } from '../../shared/roles.js';

// Residents sign up for flood alerts by SMS or email. They only get alerts from their own barangay's board.
const inputCls = 'w-full text-xs px-3 py-2 rounded-xl bg-[#f8fafc] border border-[#d9e2ec] focus:outline-none focus:ring-2 focus:ring-[#2b6e8f] text-[#123a54] placeholder-gray-400';
const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-[#6d818d] mb-1';

export default function AlertSignupCard() {
  const [via, setVia] = useState('sms'); // sms | email
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', barangay: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // { via, contact, barangay }
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.barangay) return setError('Please choose your barangay.');

    setLoading(true);
    try {
      const isSms = via === 'sms';
      const res = await fetch(`${API_BASE_URL}/api/v1/${isSms ? 'sms-residents/signup' : 'subscribers'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isSms
          ? { fullName: form.fullName, phone: form.phone, barangay: form.barangay }
          : { fullName: form.fullName, email: form.email, barangay: form.barangay, minAlertLevel: 1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || 'Sign-up failed. Please try again.');
      setDone({ via, contact: isSms ? form.phone : form.email, barangay: form.barangay });
      setForm({ fullName: '', phone: '', email: '', barangay: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#e4edf0] p-4 sm:p-5 space-y-3.5 min-w-0 w-full overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[#f1f5f6] pb-2.5">
        <div className="w-7 h-7 rounded-lg bg-[#2b6e8f]/10 text-[#2b6e8f] flex items-center justify-center">
          <Bell size={15} />
        </div>
        <div>
          <h3 className="text-xs sm:text-sm font-bold text-[#123a54] leading-tight">Get flood alerts</h3>
          <p className="text-[10px] text-[#6d818d]">By text message or email, for your barangay</p>
        </div>
      </div>

      {done ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 bg-[#f8fafc] rounded-xl p-3.5 border border-[#e2e8f0]">
            <CheckCircle2 size={18} className="text-[#2f9463] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#123a54] break-all">{done.contact}</p>
              <p className="text-[11px] text-[#6d818d] mt-0.5">
                You will get {done.via === 'sms' ? 'a text' : 'an email'} when the flood sensor in Barangay {done.barangay} detects rising water.
                {done.via === 'email' && ' Each email has a link to unsubscribe.'}
              </p>
            </div>
          </div>
          <button onClick={() => setDone(null)} className="w-full py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-[11px] font-medium cursor-pointer">
            Sign up another
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {/* SMS or Email */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#f1f5f8]">
            {[['sms', 'Text (SMS)', MessageSquare], ['email', 'Email', Mail]].map(([key, label, Icon]) => (
              <button key={key} type="button" onClick={() => { setVia(key); setError(''); }}
                className={`py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${via === key ? 'bg-white text-[#123a54] shadow-sm' : 'text-[#6d818d] hover:text-[#123a54]'}`}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          <div>
            <label className={labelCls}>Barangay <span className="text-red-500">*</span></label>
            <select required value={form.barangay} onChange={set('barangay')} className={inputCls}>
              <option value="" disabled>Choose your barangay</option>
              {BARANGAYS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>

          <div>
            <label className={labelCls}>Full name</label>
            <input value={form.fullName} onChange={set('fullName')} placeholder="Juan Dela Cruz" className={inputCls} />
          </div>

          {via === 'sms' ? (
            <div>
              <label className={labelCls}>Mobile number <span className="text-red-500">*</span></label>
              <input required value={form.phone} onChange={set('phone')} placeholder="09171234567" inputMode="tel" className={inputCls} />
            </div>
          ) : (
            <div>
              <label className={labelCls}>Email address <span className="text-red-500">*</span></label>
              <input required type="email" value={form.email} onChange={set('email')} placeholder="name@gmail.com" className={inputCls} />
            </div>
          )}

          {error && (
            <div className="text-[11px] bg-red-50 text-red-700 border border-red-200 rounded-lg p-2 font-medium">{error}</div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-2 px-3 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] text-white text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer">
            {loading && <Loader2 size={13} className="animate-spin" />}
            <span>{loading ? 'Signing up…' : via === 'sms' ? 'Sign up for text alerts' : 'Sign up for email alerts'}</span>
          </button>
          <p className="text-[10px] text-[#6d818d] text-center">Your number or email is only used for flood alerts.</p>
        </form>
      )}
    </div>
  );
}
