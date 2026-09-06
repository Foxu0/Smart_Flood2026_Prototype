import React, { useState, useEffect } from 'react';
import {
  X, Mail, Users, Radio,
  Trash2, Search, RefreshCw
} from 'lucide-react';
import { API_BASE_URL } from '../config.js';

export default function EmailSubscribersModal({ isOpen, onClose, onNotification }) {
  const [activeTab, setActiveTab] = useState('directory'); // directory | broadcasts
  const [subscribers, setSubscribers] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, unsubscribed: 0, byBarangay: {} });
  const [broadcasts, setBroadcasts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-[#e2e8f0] gap-2">
            {[
              { id: 'directory', label: `Subscribers (${subscribers.length})`, icon: Users },
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
