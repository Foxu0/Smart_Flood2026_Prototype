import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BellRing, Trash2, Plus } from 'lucide-react';
import { api } from '../../lib/session.js';
import { BARANGAYS, BARANGAY_SCOPED_ROLES } from '../../../shared/roles.js';
import { Page, PageHeader, Card, Button, Field, inputClass, Modal, ErrorNote, EmptyState } from '../../components/console/ui.jsx';

// Level 3 is the spill level (CDRRMO: water spills at about 2.0 m)
export const LEVEL_INFO = {
  1: { name: 'Level 1 · Advisory', style: 'bg-sky-50 text-sky-800 border-sky-200' },
  2: { name: 'Level 2 · Warning',  style: 'bg-amber-50 text-amber-800 border-amber-200' },
  3: { name: 'Level 3 · Spill',    style: 'bg-red-50 text-red-700 border-red-200' },
};

function LevelPill({ level }) {
  const info = LEVEL_INFO[level];
  if (!info) return null;
  return <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${info.style}`}>{info.name}</span>;
}

const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const formatTime = (v) => new Date(v).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });

// [[key, items], ...] in the order keys first appear
function groupBy(list, keyOf) {
  const groups = new Map();
  for (const item of list) {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups];
}

// Alerts under a date heading ("Oct 1, 2026") so the time is all each row needs
const groupByDay = (list) => groupBy(list, (b) => new Date(b.triggeredAt).toLocaleDateString('en-PH', { dateStyle: 'medium' }));

// Barangay staff / CDRRMO add a resident who gets alerts by SMS (mobile number) or by email
function AddResident({ kind, barangay, onCancel, onAdded }) {
  const isSms = kind === 'sms';
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', barangay });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setBusy(true); setError('');
    try {
      await api(isSms ? '/sms-residents' : '/subscribers/manual', { method: 'POST', body: form });
      onAdded();
    } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <Modal title={`${isSms ? 'Add SMS resident' : 'Add email resident'} · ${barangay}`} onClose={onCancel} footer={<>
      <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      <Button onClick={save} disabled={busy || !(isSms ? form.phone : form.email)}>Add</Button>
    </>}>
      <ErrorNote>{error}</ErrorNote>
      <div className="space-y-3">
        <Field label="Full name">
          <input className={inputClass} value={form.fullName} onChange={set('fullName')} placeholder="Juan Dela Cruz" />
        </Field>
        {isSms ? (
          <Field label="Mobile number">
            <input className={inputClass} value={form.phone} onChange={set('phone')} placeholder="09171234567" inputMode="tel" />
          </Field>
        ) : (
          <Field label="Email address">
            <input className={inputClass} value={form.email} onChange={set('email')} placeholder="juan@gmail.com" type="email" />
          </Field>
        )}
        {!isSms && <p className="text-[11px] text-[#6d818d]">They will get a welcome email with a link to unsubscribe anytime.</p>}
      </div>
    </Modal>
  );
}

export default function AlertsPage() {
  const { user } = useOutletContext();
  const [sent, setSent] = useState([]);
  const [subs, setSubs] = useState({ subscribers: [], stats: {} });
  const [sms, setSms] = useState({ data: [], mode: '' });
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState('sms'); // sms | email
  const [area, setArea] = useState(''); // CDRRMO: barangay picked in the list
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [b, c, t] = await Promise.all([
        api('/subscribers/broadcasts'),
        api('/subscribers'),
        api('/sms-residents'),
      ]);
      setSms({ data: t.data || [], mode: t.mode });
      setSent(b.broadcasts || []);
      setSubs({ subscribers: c.subscribers || [], stats: c.stats || {} });
      setError('');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const scoped = BARANGAY_SCOPED_ROLES.includes(user?.role);

  // Which barangay's residents are shown. Barangay staff: always their own. CDRRMO: picks from the list.
  const countIn = (b) => ({
    sms: sms.data.filter((r) => r.barangay === b).length,
    email: subs.subscribers.filter((s) => s.barangay === b).length,
  });
  // The 16 barangays, plus any old entry saved under another name (e.g. "Antipolo") so no one is hidden
  const areas = [...BARANGAYS, ...new Set([...sms.data, ...subs.subscribers].map((p) => p.barangay).filter((b) => !BARANGAYS.includes(b)))];
  const firstWithResidents = areas.find((b) => countIn(b).sms + countIn(b).email > 0);
  const shown = scoped ? user?.barangay : (area || firstWithResidents || areas[0]);
  const counts = countIn(shown);
  const people = (tab === 'sms' ? sms.data : subs.subscribers).filter((p) => p.barangay === shown);

  const removeSms = async (r) => {
    if (!window.confirm(`Remove ${r.fullName || r.phone} from the SMS list?`)) return;
    try { await api(`/sms-residents/${r.id}`, { method: 'DELETE' }); load(); } catch (e) { setError(e.message); }
  };

  const removeSub = async (s) => {
    if (!window.confirm(`Remove ${s.email} from the email list?`)) return;
    try { await api(`/subscribers/${s.id}`, { method: 'DELETE' }); load(); } catch (e) { setError(e.message); }
  };

  return (
    <Page>
      <PageHeader
        title="Alerts"
        subtitle="Residents who get flood alerts in each barangay, and the alerts that were sent."
      />
      <ErrorNote>{error}</ErrorNote>

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5">
        {/* LEFT: residents, organized by barangay */}
        <Card className="overflow-hidden flex flex-col lg:h-[560px]">
          <div className="px-4 py-3 border-b border-[#eef2f4]">
            <p className="text-sm font-semibold text-[#123a54]">Residents</p>
            <p className="text-[11px] text-[#6d818d]">Residents only get alerts from their own barangay&apos;s board</p>
          </div>

          <div className="flex-1 min-h-0 flex flex-col sm:flex-row">
            {/* Barangay list (CDRRMO only) */}
            {!scoped && (
              <>
                <select className={`${inputClass} sm:hidden m-3 w-auto`} value={shown} onChange={(e) => setArea(e.target.value)} aria-label="Barangay">
                  {areas.map((b) => <option key={b}>{b}</option>)}
                </select>
                <ul className="hidden sm:block w-48 shrink-0 border-r border-[#eef2f4] overflow-y-auto">
                  {areas.map((b) => {
                    const c = countIn(b);
                    const active = b === shown;
                    return (
                      <li key={b}>
                        <button onClick={() => setArea(b)}
                          className={`w-full text-left px-4 py-2 border-l-2 ${active ? 'bg-[#f1f6f8] border-[#123a54]' : 'border-transparent hover:bg-[#f8fafb]'}`}>
                          <p className={`text-sm ${active ? 'font-semibold text-[#123a54]' : 'text-[#3f5361]'}`}>{b}</p>
                          <p className="text-[11px] text-[#6d818d]">{c.sms} SMS · {plural(c.email, 'email')}</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {/* Selected barangay: SMS / Email sub-tabs */}
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="px-4 pt-3 border-b border-[#eef2f4] flex items-end justify-between gap-2">
                <div className="flex gap-4">
                  {[['sms', `SMS · ${counts.sms}`], ['email', `Email · ${counts.email}`]].map(([key, label]) => (
                    <button key={key} onClick={() => setTab(key)}
                      className={`pb-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === key ? 'text-[#123a54] border-[#123a54]' : 'text-[#6d818d] border-transparent hover:text-[#123a54]'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <Button size="sm" className="mb-2" onClick={() => setAdding(true)}><Plus size={13} /> {tab === 'sms' ? 'Add number' : 'Add email'}</Button>
              </div>
              <p className="px-4 py-2 text-[11px] text-[#6d818d] border-b border-[#eef2f4]">
                {tab === 'sms'
                  ? <>{shown} residents who get a text.{sms.mode === 'SIMULATED' && ' Texts are simulated for now.'}</>
                  : `${shown} residents who get an email. They can also sign up on the public website.`}
              </p>

              {loading ? (
                <p className="px-4 py-6 text-sm text-[#6d818d]">Loading…</p>
              ) : people.length === 0 ? (
                <p className="px-4 py-6 text-sm text-[#6d818d]">
                  {tab === 'sms' ? `No numbers in ${shown} yet. Click “Add number” to register a resident.` : `No emails in ${shown} yet. Click “Add email” to register a resident.`}
                </p>
              ) : (
                <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#eef2f4] max-h-[420px] lg:max-h-none">
                  {people.map((p) => (
                    <li key={p.id} className="pl-4 pr-2 py-2 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#123a54] truncate">{p.fullName || p.phone || p.email}</p>
                        {(p.fullName || p.status === 'UNSUBSCRIBED') && (
                          <p className="text-[11px] text-[#6d818d] truncate">
                            {[p.fullName && (p.phone || p.email), p.status === 'UNSUBSCRIBED' && 'Unsubscribed'].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => (tab === 'sms' ? removeSms(p) : removeSub(p))}
                        aria-label={`Remove ${p.phone || p.email}`}><Trash2 size={14} /></Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>

        {/* RIGHT: alert history, grouped by date */}
        <Card className="overflow-hidden flex flex-col lg:h-[560px]">
          <div className="px-4 py-3 border-b border-[#eef2f4]">
            <p className="text-sm font-semibold text-[#123a54]">Alert history</p>
            <p className="text-[11px] text-[#6d818d]">Sent automatically when a board reaches Level 1 or higher</p>
          </div>
          {loading ? (
            <p className="px-4 py-8 text-sm text-center text-[#6d818d]">Loading…</p>
          ) : sent.length === 0 ? (
            <EmptyState icon={BellRing} title="No alerts yet">Alerts appear here when a board reaches Level 1 or higher.</EmptyState>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto max-h-[480px] lg:max-h-none">
              {groupByDay(sent).map(([day, items]) => (
                <div key={day}>
                  <p className="sticky top-0 px-4 py-1.5 bg-[#f6f9fa] text-[11px] font-semibold text-[#6d818d] border-b border-[#eef2f4]">{day}</p>
                  <ul className="divide-y divide-[#eef2f4]">
                    {items.map((b) => (
                      <li key={b.id} className="px-4 py-2.5" title={b.message}>
                        <div className="flex items-center gap-2">
                          <LevelPill level={b.alertLevel} />
                          <span className="text-sm font-semibold text-[#123a54]">{Number(b.waterLevelM).toFixed(2)} m</span>
                          <span className="ml-auto text-[11px] text-[#6d818d] whitespace-nowrap">{formatTime(b.triggeredAt)}</span>
                        </div>
                        <p className="text-[11px] text-[#6d818d] mt-1">
                          {b.node?.name ? `${b.node.name} · ` : ''}Sent to {plural(b._count?.dispatchLogs ?? 0, 'email')} · {b._count?.smsLogs ?? 0} SMS
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {adding && (
        <AddResident
          kind={tab}
          barangay={shown}
          onCancel={() => setAdding(false)}
          onAdded={() => { setAdding(false); load(); }}
        />
      )}
    </Page>
  );
}
