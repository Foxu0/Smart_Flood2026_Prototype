import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Cpu, Plus, Pencil, Replace, Wrench, KeyRound, Trash2, Copy, Check, RefreshCw, MapPin, Power,
} from 'lucide-react';
import { api } from '../../lib/session.js';
import { can, BARANGAYS, BARANGAY_SCOPED_ROLES, SENSOR_TYPES } from '../../../shared/roles.js';
import { Page, PageHeader, Card, Button, Field, inputClass, Modal, ErrorNote, EmptyState, formatDateTime } from '../../components/console/ui.jsx';

const STATUS_STYLE = {
  ACTIVE:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  MAINTENANCE: 'bg-amber-50 text-amber-800 border-amber-200',
  OFFLINE:     'bg-slate-100 text-slate-600 border-slate-200',
  RETIRED:     'bg-slate-50 text-slate-400 border-slate-200',
};
const CONNECTIVITY_DOT = { ONLINE: 'bg-emerald-500', OFFLINE: 'bg-red-500', NEVER_SEEN: 'bg-slate-300' };
const CONNECTIVITY_LABEL = { ONLINE: 'Online', OFFLINE: 'Not reporting', NEVER_SEEN: 'Never connected' };

const EMPTY_FORM = {
  nodeId: '', name: '', barangay: 'Mayamot', locationLabel: '', latitude: '', longitude: '',
  mountHeightCm: 240, sensors: ['WATER_LEVEL', 'FLOW_SPEED'], boardSerial: '', firmwareVersion: '', notes: '',
};

function StatusPill({ status }) {
  return <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[status]}`}>{status}</span>;
}

/** Shown once after create / replace / rotate — the server never returns the key again. */
function ApiKeyModal({ result, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(result.apiKey); setCopied(true); } catch { /* clipboard blocked */ }
  };
  return (
    <Modal title="Board API key" onClose={onClose} footer={<Button onClick={onClose}>I saved the key</Button>}>
      <p className="text-sm text-[#3f5361] mb-3">
        Flash this key into <b>{result.device.nodeId}</b>'s firmware (<code className="text-xs">DEVICE_API_KEY</code>).
        It is shown <b>only once</b> — if you lose it, rotate the key.
      </p>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 min-w-0 break-all bg-[#0a1826] text-emerald-300 text-xs rounded-xl px-3 py-2.5 font-mono">{result.apiKey}</code>
        <Button variant="secondary" onClick={copy} aria-label="Copy key">{copied ? <Check size={15} /> : <Copy size={15} />}</Button>
      </div>
      <p className="text-[11px] text-[#6d818d] mt-3">
        The board sends it as the <code>X-Device-Key</code> header on <code>POST /api/v1/telemetry</code>.
      </p>
    </Modal>
  );
}

function DeviceForm({ initial, mode, lockBarangay, onCancel, onSubmit }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleSensor = (s) => setForm((f) => ({
    ...f, sensors: f.sensors.includes(s) ? f.sensors.filter((x) => x !== s) : [...f.sensors, s],
  }));

  const submit = async () => {
    setBusy(true); setError('');
    try { await onSubmit(form); } catch (e) { setError(e.message); setBusy(false); }
  };

  const title = mode === 'create' ? 'Add hardware board' : mode === 'replace' ? `Replace board at ${initial.nodeId}` : `Edit ${initial.nodeId}`;
  const isReplace = mode === 'replace';

  return (
    <Modal title={title} onClose={onCancel} wide footer={<>
      <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      <Button onClick={submit} disabled={busy}>{mode === 'create' ? 'Register board' : isReplace ? 'Swap board & get new key' : 'Save changes'}</Button>
    </>}>
      <ErrorNote>{error}</ErrorNote>
      {isReplace && (
        <p className="text-sm text-[#3f5361] mb-4 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          Use this when you swap the physical ESP32 at this site. The site keeps its name, location and all past
          readings. The new board gets a <b>new API key</b> and the old key stops working.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {!isReplace && (
          <>
            <Field label="Node ID" hint="e.g. NODE-002">
              <input className={inputClass} value={form.nodeId} onChange={set('nodeId')} />
            </Field>
            <Field label="Site name">
              <input className={inputClass} value={form.name} onChange={set('name')} placeholder="Mayamot Bridge Station" />
            </Field>
          </>
        )}
        {!isReplace && (
          <>
            <Field label="Barangay">
              <select className={inputClass} value={form.barangay} onChange={set('barangay')} disabled={lockBarangay}>
                {BARANGAYS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Site / landmark">
              <input className={inputClass} value={form.locationLabel || ''} onChange={set('locationLabel')} placeholder="Under Marcos Hwy bridge" />
            </Field>
            <Field label="Latitude">
              <input className={inputClass} type="number" step="any" value={form.latitude ?? ''} onChange={set('latitude')} placeholder="14.6178" />
            </Field>
            <Field label="Longitude">
              <input className={inputClass} type="number" step="any" value={form.longitude ?? ''} onChange={set('longitude')} placeholder="121.1336" />
            </Field>
          </>
        )}
        <Field label="Sensor mount height (cm)" hint="Distance from sensor face to dry riverbed">
          <input className={inputClass} type="number" value={form.mountHeightCm} onChange={set('mountHeightCm')} />
        </Field>
        <Field label="Board serial / label" hint="Sticker or MAC address on the ESP32">
          <input className={inputClass} value={form.boardSerial || ''} onChange={set('boardSerial')} placeholder="ESP32-A1B2C3" />
        </Field>
        <Field label="Firmware version">
          <input className={inputClass} value={form.firmwareVersion || ''} onChange={set('firmwareVersion')} placeholder="2026.11" />
        </Field>
      </div>
      <div className="mt-3">
        <span className="block text-xs font-semibold text-slate-700 mb-1.5">Sensors on this board</span>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SENSOR_TYPES).map(([key, label]) => (
            <label key={key} className={`cursor-pointer select-none px-3 py-1.5 rounded-xl border text-xs font-semibold ${form.sensors.includes(key) ? 'bg-[#123a54] text-white border-[#123a54]' : 'bg-white text-[#3f5361] border-slate-200'}`}>
              <input type="checkbox" className="sr-only" checked={form.sensors.includes(key)} onChange={() => toggleSensor(key)} />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <Field label="Notes">
          <textarea className={inputClass} rows={2} value={form.notes || ''} onChange={set('notes')} />
        </Field>
      </div>
    </Modal>
  );
}

export default function DevicesPage() {
  const { user } = useOutletContext();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRetired, setShowRetired] = useState(false);
  const [editor, setEditor] = useState(null); // { mode, device? }
  const [keyResult, setKeyResult] = useState(null);
  const [globalMaint, setGlobalMaint] = useState(null);

  const canManage = can(user?.role, 'devices.manage');
  const canMaint = can(user?.role, 'devices.maintenance');
  const canDelete = can(user?.role, 'devices.delete');
  const canGlobal = can(user?.role, 'system.maintenance');
  const scoped = BARANGAY_SCOPED_ROLES.includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await api('/devices');
      setDevices(json.data); setGlobalMaint(json.globalMaintenance || null); setError('');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (fn) => {
    try { await fn(); await load(); } catch (e) { setError(e.message); }
  };

  const toggleGlobal = () => {
    if (globalMaint) {
      act(() => api('/devices/maintenance/global', { method: 'POST', body: { enabled: false } }));
      return;
    }
    const reason = window.prompt('Reason for system-wide maintenance (all boards stop sending alerts):', 'System maintenance');
    if (reason === null) return;
    act(() => api('/devices/maintenance/global', { method: 'POST', body: { enabled: true, reason } }));
  };

  const handleSubmit = async (form) => {
    const body = { ...form };
    if (editor.mode === 'create') {
      const json = await api('/devices', { method: 'POST', body });
      setKeyResult({ device: json.data, apiKey: json.apiKey });
    } else if (editor.mode === 'replace') {
      const json = await api(`/devices/${editor.device.id}/replace`, { method: 'POST', body });
      setKeyResult({ device: json.data, apiKey: json.apiKey });
    } else {
      await api(`/devices/${editor.device.id}`, { method: 'PUT', body });
    }
    setEditor(null);
    load();
  };

  const toggleMaintenance = (d) => {
    const enabling = d.status !== 'MAINTENANCE';
    const reason = enabling ? window.prompt(`Why is ${d.nodeId} going into maintenance?`, 'Cleaning sensor') : null;
    if (enabling && reason === null) return;
    act(() => api(`/devices/${d.id}/maintenance`, { method: 'POST', body: { enabled: enabling, reason } }));
  };

  const rotateKey = (d) => {
    if (!window.confirm(`Issue a new API key for ${d.nodeId}? The board stops reporting until it is reflashed with the new key.`)) return;
    act(async () => {
      const json = await api(`/devices/${d.id}/rotate-key`, { method: 'POST' });
      setKeyResult({ device: json.data, apiKey: json.apiKey });
    });
  };

  const retire = (d) => {
    if (!window.confirm(`Retire the site ${d.nodeId}? Its board will stop accepting readings. History is kept.`)) return;
    act(() => api(`/devices/${d.id}/status`, { method: 'PUT', body: { status: 'RETIRED' } }));
  };

  const remove = (d) => {
    if (!window.confirm(`Permanently delete ${d.nodeId} from the registry? Telemetry history is kept but unlinked.`)) return;
    act(() => api(`/devices/${d.id}`, { method: 'DELETE' }));
  };

  const visible = devices.filter((d) => showRetired || d.status !== 'RETIRED');
  const counts = {
    total: devices.filter((d) => d.status !== 'RETIRED').length,
    online: devices.filter((d) => d.status !== 'RETIRED' && d.connectivity === 'ONLINE').length,
    maintenance: devices.filter((d) => d.status === 'MAINTENANCE').length,
  };

  return (
    <Page>
      <PageHeader
        title="Hardware"
        subtitle={scoped
          ? `Sensor boards installed in Barangay ${user?.barangay}. Add new boards, swap out faulty ones, or put a board in maintenance mode while you work on it.`
          : 'Every ESP32 sensor board in the network. Maintenance mode keeps storing readings but stops automated alerts and sirens from that board.'}
        actions={<>
          <Button variant="secondary" onClick={load}><RefreshCw size={15} /> Refresh</Button>
          {canManage && (
            <Button onClick={() => setEditor({ mode: 'create', device: { ...EMPTY_FORM, barangay: scoped ? user.barangay : 'Mayamot' } })}>
              <Plus size={15} /> Add board
            </Button>
          )}
        </>}
      />

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[['Boards in service', counts.total], ['Reporting now', counts.online], ['In maintenance', counts.maintenance]].map(([label, n]) => (
          <Card key={label} className="px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#6d818d]">{label}</p>
            <p className="font-display text-2xl font-bold text-[#123a54]">{n}</p>
          </Card>
        ))}
      </div>

      <ErrorNote>{error}</ErrorNote>

      {(globalMaint || canGlobal) && (
        <Card className={`px-4 py-3 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${globalMaint ? 'border-amber-300 bg-amber-50' : ''}`}>
          <div>
            <p className="text-sm font-semibold text-[#123a54]">
              {globalMaint ? 'System-wide maintenance is ON' : 'System-wide maintenance'}
            </p>
            <p className="text-xs text-[#6d818d]">
              {globalMaint
                ? `${globalMaint.reason} · started ${formatDateTime(globalMaint.startedAt)} by ${globalMaint.createdByName}. No automatic alerts are sent from any board.`
                : 'Pause automatic alerts from every board at once, e.g. during a system upgrade.'}
            </p>
          </div>
          {canGlobal && (
            <Button variant={globalMaint ? 'primary' : 'secondary'} onClick={toggleGlobal}>
              <Wrench size={15} /> {globalMaint ? 'End maintenance' : 'Start maintenance'}
            </Button>
          )}
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#eef2f4]">
          <p className="text-sm font-semibold text-[#123a54]">Registered boards</p>
          <label className="flex items-center gap-2 text-xs text-[#6d818d]">
            <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} /> Show retired
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-[#6d818d] px-4 py-8 text-center">Loading boards…</p>
        ) : visible.length === 0 ? (
          <EmptyState icon={Cpu} title="No boards registered yet">
            {canManage ? 'Use “Add board” to register your first ESP32 node and get its API key.' : 'Ask an administrator to register a board.'}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-[#eef2f4]">
            {visible.map((d) => (
              <li key={d.id} className={`px-4 py-4 flex flex-col md:flex-row md:items-center gap-3 ${d.status === 'RETIRED' ? 'opacity-60' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[#123a54]">{d.nodeId}</span>
                    <StatusPill status={d.status} />
                    {d.isDefault && <span className="px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide bg-sky-50 text-sky-700 border-sky-200">Default</span>}
                    {d.status !== 'RETIRED' && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-[#6d818d]">
                        <span className={`w-2 h-2 rounded-full ${CONNECTIVITY_DOT[d.connectivity]}`} />
                        {CONNECTIVITY_LABEL[d.connectivity]}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#3f5361] mt-0.5">{d.name}</p>
                  <p className="text-[11px] text-[#6d818d] mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="inline-flex items-center gap-1"><MapPin size={11} /> {d.barangay}{d.locationLabel ? ` · ${d.locationLabel}` : ''}</span>
                    <span>Sensors: {d.sensors.map((s) => SENSOR_TYPES[s] || s).join(', ')}</span>
                    <span>Mount {d.mountHeightCm} cm</span>
                    <span>Last report {formatDateTime(d.lastSeenAt)}</span>
                    {d.boardSerial && <span>Board {d.boardSerial}</span>}
                    <span>{d.hasKey ? (d.apiKeyPrefix ? `Key sfk_${d.apiKeyPrefix}_…` : 'Key set') : 'No key yet (use the key button)'}</span>
                  </p>
                </div>

                {d.status !== 'RETIRED' && (
                  <div className="flex flex-wrap gap-1.5">
                    {canMaint && (
                      <Button size="sm" variant={d.status === 'MAINTENANCE' ? 'primary' : 'secondary'} onClick={() => toggleMaintenance(d)}>
                        <Wrench size={13} /> {d.status === 'MAINTENANCE' ? 'End maintenance' : 'Maintenance'}
                      </Button>
                    )}
                    {canManage && <>
                      <Button size="sm" variant="secondary" onClick={() => setEditor({ mode: 'edit', device: { ...EMPTY_FORM, ...d } })}><Pencil size={13} /> Edit</Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditor({ mode: 'replace', device: { ...EMPTY_FORM, ...d, boardSerial: '', firmwareVersion: '', notes: '' } })}><Replace size={13} /> Replace</Button>
                      <Button size="sm" variant="ghost" onClick={() => rotateKey(d)} title="Rotate API key"><KeyRound size={13} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => retire(d)} title="Retire board"><Power size={13} /></Button>
                    </>}
                  </div>
                )}
                {canDelete && d.status === 'RETIRED' && !d.isDefault && (
                  <Button size="sm" variant="ghost" onClick={() => remove(d)}><Trash2 size={13} /> Delete</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editor && (
        <DeviceForm
          initial={editor.device}
          mode={editor.mode}
          lockBarangay={scoped}
          onCancel={() => setEditor(null)}
          onSubmit={handleSubmit}
        />
      )}
      {keyResult && <ApiKeyModal result={keyResult} onClose={() => setKeyResult(null)} />}
    </Page>
  );
}
