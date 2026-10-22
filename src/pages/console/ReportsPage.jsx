import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Download } from 'lucide-react';
import { api, getToken } from '../../lib/session.js';
import { API_BASE_URL } from '../../config.js';
import { can, BARANGAY_SCOPED_ROLES } from '../../../shared/roles.js';
import { Page, PageHeader, Card, Button, Field, inputClass, ErrorNote } from '../../components/console/ui.jsx';
import SystemToolsCard from '../../components/console/SystemToolsCard.jsx';

const toInputDate = (d) => d.toISOString().slice(0, 10);

function saveFile(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Plain-language text for each logged action (sign-ins are left out to keep the list short)
const ACTION_TEXT = {
  'device.create':           (t) => `added board ${t}`,
  'device.update':           (t) => `edited board ${t}`,
  'device.replace':          (t) => `swapped the board of ${t}`,
  'device.thresholds':       (t) => `changed the alert levels of ${t}`,
  'device.thresholds_reset': (t) => `reset the alert levels of ${t}`,
  'device.turned_off':       (t) => `turned off ${t}`,
  'device.turned_on':        (t) => `turned on ${t}`,
  'user.create':             (t) => `created the account ${t}`,
  'user.update':             (t) => `edited the account ${t}`,
  'user.delete':             (t) => `deleted the account ${t}`,
  'auth.update_profile':     () => 'changed their password',
  'siren.enable':            () => 'turned on the siren',
  'siren.trigger':           () => 'turned on the siren',
  'siren.test':              () => 'tested the siren',
  'siren.mute':              () => 'turned off the siren',
  'siren.disable':           () => 'turned off the siren',
  'subscriber.add':          (t) => `added ${t} to the email list`,
  'subscriber.delete':       (t) => `removed ${t} from the email list`,
  'sms.add':                 (t) => `added ${t} to the SMS list`,
  'sms.delete':              (t) => `removed ${t} from the SMS list`,
  'logs.reset':              () => 'reset all sensor logs',
  // older entries (saved before the current version)
  'device.maintenance_on':   (t) => `turned off ${t}`,
  'device.maintenance_off':  (t) => `turned on ${t}`,
};
const HIDDEN = ['auth.login', 'auth.logout'];

function shortTime(v) {
  return new Date(v).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function ActivityLog() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/users/audit?limit=200')
      .then((j) => setRows(j.data.filter((r) => !HIDDEN.includes(r.action)).slice(0, 50)))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <Card className="overflow-hidden mt-4">
      <p className="px-4 py-3 border-b border-[#eef2f4] text-sm font-semibold text-[#123a54]">Activity log</p>
      <ErrorNote>{error}</ErrorNote>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-[#6d818d]">No changes yet.</p>
      ) : (
        <ul className="divide-y divide-[#eef2f4] max-h-[360px] overflow-y-auto">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-2 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-[#3f5361]">
                <b className="font-semibold text-[#123a54]">{r.actorName}</b>{' '}
                {ACTION_TEXT[r.action] ? ACTION_TEXT[r.action](r.target || '') : `${r.action}${r.target ? ` · ${r.target}` : ''}`}
              </span>
              <span className="text-[11px] text-[#6d818d] whitespace-nowrap">{shortTime(r.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function ReportsPage() {
  const { user } = useOutletContext();
  const scoped = BARANGAY_SCOPED_ROLES.includes(user?.role);
  const [boards, setBoards] = useState([]);
  const [nodeId, setNodeId] = useState('');
  const [from, setFrom] = useState(() => toInputDate(new Date(Date.now() - 7 * 864e5)));
  const [to, setTo] = useState(() => toInputDate(new Date()));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/devices').then((j) => {
      const list = j.data.filter((d) => d.status !== 'RETIRED');
      setBoards(list);
      if (scoped && list[0]) setNodeId(String(list[0].id)); // barangay staff: their own board
    }).catch((e) => setError(e.message));
  }, [scoped]);

  const range = useCallback(() => {
    const q = new URLSearchParams({ from: new Date(`${from}T00:00:00`).toISOString(), to: new Date(`${to}T23:59:59`).toISOString() });
    if (nodeId) q.set('nodeId', nodeId);
    return q;
  }, [from, to, nodeId]);

  const boardLabel = boards.find((b) => String(b.id) === nodeId)?.nodeId || 'all-boards';

  // Both reports are made on the server: water levels (one row per 10 minutes) and alerts
  const download = async (path, name) => {
    setBusy(true); setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/telemetry/${path}?${range()}`, { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error('Could not create the report.');
      saveFile(`SmartFlood_${name}_${boardLabel}_${from}_to_${to}.csv`, await res.blob());
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  const downloadReadings = () => download('export/csv', 'water_levels');
  const downloadAlerts = () => download('export/alerts-csv', 'alerts');


  return (
    <Page>
      <PageHeader title="Reports" subtitle="Download water levels or alerts for any period." />
      <ErrorNote>{error}</ErrorNote>

      <Card className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto_auto] gap-2 items-end">
          <div className="col-span-2 lg:col-span-1">
            <Field label="Board">
              <select className={inputClass} value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
                {!scoped && <option value="">All boards</option>}
                {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="From">
            <input type="date" className={inputClass} value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" className={inputClass} value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Button onClick={downloadReadings} disabled={busy}><Download size={15} /> Water level readings (CSV)</Button>
          <Button variant="secondary" onClick={downloadAlerts} disabled={busy}><Download size={15} /> Alerts (CSV)</Button>
        </div>
        <p className="text-[11px] text-[#6d818d] mt-2">Downloads a CSV file you can open in Excel. Water levels: one row per 10 minutes (highest level).</p>
      </Card>

      {can(user?.role, 'audit.view') && <ActivityLog />}
      {can(user?.role, 'system.maintenance') && <div className="mt-4"><SystemToolsCard /></div>}
    </Page>
  );
}
