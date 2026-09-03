import React, { useState, useEffect } from 'react';
import {
  X, Mail, Users, Send, AlertTriangle,
  Trash2, Search, Loader2, ShieldAlert, Radio, RefreshCw, ExternalLink
} from 'lucide-react';
import { API_BASE_URL } from '../config.js';

export default function EmailSubscribersModal({ isOpen, onClose, onNotification }) {
  const [activeTab, setActiveTab] = useState('directory'); // directory | test | broadcasts
  const [subscribers, setSubscribers] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, unsubscribed: 0, byBarangay: {} });
  const [broadcasts, setBroadcasts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Test Email form state
  const [testEmail, setTestEmail] = useState('');
  const [testLevel, setTestLevel] = useState(2);
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Manual broadcast state
  const [manualTitle, setManualTitle] = useState('⚠️ MANUAL FLOOD ADVISORY');
  const [manualMsg, setManualMsg] = useState('CDRRMO flood warning: Rapid river rise detected.');
  const [manualLevel, setManualLevel] = useState(2);
  const [broadcasting, setBroadcasting] = useState(false);

  // Auth header helper
  const getAuthHeader = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${sessionStorage.getItem('sf_token') || ''}`,
  });

  const fetchSubscribers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/subscribers`);
      const data = await res.json();
      if (data.success) {
        setSubscribers(data.subscribers || []);
        setStats(data.stats || { total: 0, active: 0, unsubscribed: 0, byBarangay: {} });
      }
    } catch (err) {
      console.error('Failed to fetch subscribers:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBroadcasts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/subscribers/broadcasts`);
      const data = await res.json();
      if (data.success) {
        setBroadcasts(data.broadcasts || []);
      }
    } catch (err) {
      console.error('Failed to fetch broadcasts:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSubscribers();
      fetchBroadcasts();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleDeleteSubscriber = async (id, email) => {
    if (!window.confirm(`Delete subscriber "${email}"? This action cannot be undone.`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/subscribers/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      const data = await res.json();
      if (data.success) {
        setSubscribers((prev) => prev.filter((s) => s.id !== id));
        setStats((prev) => ({ ...prev, total: prev.total - 1, active: Math.max(0, prev.active - 1) }));
        if (onNotification) onNotification({ type: 'notice', msg: `Subscriber ${email} deleted.` });
      } else {
        alert(data.error || 'Failed to delete subscriber.');
      }
    } catch (err) {
      alert('Error deleting subscriber: ' + err.message);
    }
  };

  const handleSendTestEmail = async (e) => {
    e.preventDefault();
    if (!testEmail) return;

    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/subscribers/test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: testEmail, level: testLevel }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          msg: `Dispatched Level ${testLevel} test email to ${testEmail}!`,
          previewUrl: data.data?.previewUrl,
          isEthereal: data.data?.isEthereal,
        });
        if (onNotification) onNotification({ type: 'weather', msg: `Test alert email sent to ${testEmail}` });
      } else {
        throw new Error(data.error || 'Failed to dispatch test email.');
      }
    } catch (err) {
      setTestResult({ success: false, msg: err.message });
    } finally {
      setSendingTest(false);
    }
  };

  const handleManualBroadcast = async (e) => {
    e.preventDefault();
    if (!window.confirm(`Broadcast Level ${manualLevel} email alert to ALL ${stats.active} active subscribers?`)) return;

    setBroadcasting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/subscribers/broadcast`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify({
          title: manualTitle,
          message: manualMsg,
          level: manualLevel,
          waterLevelM: 1.55,
          force: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Alert broadcast sent! ${data.data.sent} sent, ${data.data.failed} failed.`);
        fetchBroadcasts();
        setActiveTab('broadcasts');
      } else {
        alert(data.error || 'Broadcast failed.');
      }
    } catch (err) {
      alert('Error sending broadcast: ' + err.message);
    } finally {
      setBroadcasting(false);
    }
  };

  if (!isOpen) return null;

  const filteredSubscribers = subscribers.filter(
    (s) =>
      s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.fullName && s.fullName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.barangay && s.barangay.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#123a54] text-[#123a54] rounded-2xl shadow-2xl border border-[#123a54] overflow-hidden flex flex-col max-h-[90vh] w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#123a54] text-white px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-400/20">
              <Mail size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Email Early Warning System
              </h2>
              <p className="text-[11px] text-sky-200/80">Subscriber Directory &amp; Flood Broadcast Center</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sky-200 hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="bg-[#f8fafc] p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 font-sans">
          
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white p-3 rounded-xl border border-[#e2e8f0] shadow-2xs">
              <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Total Registered</span>
              <p className="text-xl font-bold text-[#0f172a] mt-0.5">{stats.total}</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-[#e2e8f0] shadow-2xs">
              <span className="text-[10px] font-bold text-[#2f9463] uppercase tracking-wider">Active Recipients</span>
              <p className="text-xl font-bold text-[#2f9463] mt-0.5">{stats.active}</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-[#e2e8f0] shadow-2xs">
              <span className="text-[10px] font-bold text-[#e0522f] uppercase tracking-wider">Unsubscribed</span>
              <p className="text-xl font-bold text-[#e0522f] mt-0.5">{stats.unsubscribed}</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-[#e2e8f0] shadow-2xs">
              <span className="text-[10px] font-bold text-[#2b6e8f] uppercase tracking-wider">Top Barangay</span>
              <p className="text-base font-bold text-[#2b6e8f] mt-0.5 truncate">
                {Object.keys(stats.byBarangay || {})[0] || 'Mayamot'}
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-[#e2e8f0] gap-2">
            {[
              { id: 'directory', label: `Subscribers (${subscribers.length})`, icon: Users },
              { id: 'test', label: 'Test Email & Broadcast', icon: Send },
              { id: 'broadcasts', label: `Broadcast Logs (${broadcasts.length})`, icon: Radio },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`pb-2.5 px-3 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border-b-2 -mb-px ${
                  activeTab === id
                    ? 'border-[#2b6e8f] text-[#2b6e8f]'
                    : 'border-transparent text-[#64748b] hover:text-[#0f172a]'
                }`}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* ── TAB 1: DIRECTORY ─────────────────────────────────────────── */}
          {activeTab === 'directory' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by email, name, or barangay..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white border border-[#d9e2ec] focus:outline-none focus:ring-2 focus:ring-[#2b6e8f]"
                  />
                </div>
                <button
                  onClick={fetchSubscribers}
                  disabled={loading}
                  className="p-2 rounded-xl bg-white hover:bg-gray-100 border border-[#d9e2ec] text-gray-600 transition cursor-pointer"
                  title="Refresh list"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden shadow-2xs">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#f8fafc] text-[#64748b] font-bold text-[10px] uppercase border-b border-[#e2e8f0]">
                      <tr>
                        <th className="py-2.5 px-3">Subscriber</th>
                        <th className="py-2.5 px-3">Barangay</th>
                        <th className="py-2.5 px-3">Filter</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9]">
                      {filteredSubscribers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-6 text-[#94a3b8]">
                            No subscribers found.
                          </td>
                        </tr>
                      ) : (
                        filteredSubscribers.map((sub) => (
                          <tr key={sub.id} className="hover:bg-[#fbfdfe] transition">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-[#0f172a]">{sub.email}</div>
                              {sub.fullName && <div className="text-[10px] text-[#64748b]">{sub.fullName}</div>}
                            </td>
                            <td className="py-2.5 px-3 text-[#475569]">{sub.barangay}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  sub.minAlertLevel === 1
                                    ? 'bg-sky-100 text-sky-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                Level {sub.minAlertLevel}+
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  sub.status === 'ACTIVE'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {sub.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => handleDeleteSubscriber(sub.id, sub.email)}
                                className="p-1 rounded-lg hover:bg-red-50 text-red-500 transition cursor-pointer"
                                title="Remove subscriber"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: TEST & BROADCAST ───────────────────────────────────── */}
          {activeTab === 'test' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Test Alert Dispatch Card */}
              <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-2xs space-y-3">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                  <Send size={15} className="text-[#2b6e8f]" />
                  <h3 className="text-xs font-bold text-[#0f172a]">Send Test Warning Email</h3>
                </div>
                <form onSubmit={handleSendTestEmail} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#64748b] mb-1">
                      Recipient Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="operator@antipolo.gov.ph"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-lg bg-[#f8fafc] border border-[#d9e2ec] focus:outline-none focus:ring-2 focus:ring-[#2b6e8f]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#64748b] mb-1">
                      Test Alert Level
                    </label>
                    <select
                      value={testLevel}
                      onChange={(e) => setTestLevel(Number(e.target.value))}
                      className="w-full text-xs px-3 py-1.5 rounded-lg bg-[#f8fafc] border border-[#d9e2ec]"
                    >
                      <option value={1}>Level 1: Advisory Watch</option>
                      <option value={2}>Level 2: Siren Warning Alarm</option>
                      <option value={3}>Level 3: Critical Evacuation</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={sendingTest}
                    className="w-full py-2 rounded-lg bg-[#2b6e8f] hover:bg-[#1f6f94] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                  >
                    {sendingTest ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    <span>{sendingTest ? 'Dispatching...' : 'Send Test Alert Email'}</span>
                  </button>
                </form>

                {testResult && (
                  <div
                    className={`p-2.5 rounded-lg text-xs border ${
                      testResult.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
                    }`}
                  >
                    <p className="font-semibold">{testResult.msg}</p>
                    {testResult.previewUrl && (
                      <a
                        href={testResult.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-[11px] text-sky-600 underline font-semibold"
                      >
                        <ExternalLink size={11} /> Open Ethereal Test Email Preview
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Manual Operator Broadcast Card */}
              <div className="bg-white p-4 rounded-xl border border-[#e2e8f0] shadow-2xs space-y-3">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                  <ShieldAlert size={15} className="text-[#e0522f]" />
                  <h3 className="text-xs font-bold text-[#0f172a]">Live Operator Emergency Broadcast</h3>
                </div>
                <form onSubmit={handleManualBroadcast} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#64748b] mb-1">
                      Advisory Headline
                    </label>
                    <input
                      type="text"
                      required
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-lg bg-[#f8fafc] border border-[#d9e2ec]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#64748b] mb-1">
                      Message Body
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={manualMsg}
                      onChange={(e) => setManualMsg(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-lg bg-[#f8fafc] border border-[#d9e2ec]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-[#64748b] mb-1">
                      Severity Level
                    </label>
                    <select
                      value={manualLevel}
                      onChange={(e) => setManualLevel(Number(e.target.value))}
                      className="w-full text-xs px-3 py-1.5 rounded-lg bg-[#f8fafc] border border-[#d9e2ec]"
                    >
                      <option value={2}>Level 2: Warning Alarm</option>
                      <option value={3}>Level 3: Critical Danger / Evacuate</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={broadcasting || stats.active === 0}
                    className="w-full py-2 rounded-lg bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60 shadow-sm"
                  >
                    {broadcasting ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
                    <span>{broadcasting ? 'Broadcasting...' : `Broadcast to ${stats.active} Subscribers`}</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ── TAB 3: BROADCAST HISTORY ─────────────────────────────────── */}
          {activeTab === 'broadcasts' && (
            <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden shadow-2xs">
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f8fafc] text-[#64748b] font-bold text-[10px] uppercase border-b border-[#e2e8f0]">
                    <tr>
                      <th className="py-2.5 px-3">Date / Time (UTC)</th>
                      <th className="py-2.5 px-3">Severity</th>
                      <th className="py-2.5 px-3">Title</th>
                      <th className="py-2.5 px-3">Water Level</th>
                      <th className="py-2.5 px-3">Dispatches</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f5f9]">
                    {broadcasts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-[#94a3b8]">
                          No broadcast records found.
                        </td>
                      </tr>
                    ) : (
                      broadcasts.map((b) => (
                        <tr key={b.id} className="hover:bg-[#fbfdfe] transition">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-[#64748b]">
                            {new Date(b.triggeredAt).toLocaleString('en-PH')}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                b.alertLevel === 3
                                  ? 'bg-red-100 text-red-800'
                                  : b.alertLevel === 2
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              Level {b.alertLevel}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[#0f172a]">{b.title}</td>
                          <td className="py-2.5 px-3 font-mono">{Number(b.waterLevelM).toFixed(2)} m</td>
                          <td className="py-2.5 px-3 font-semibold text-[#2f9463]">
                            {b._count?.dispatchLogs ?? 0} sent
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
