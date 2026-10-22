import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Cpu, Plus, Pencil, Replace } from 'lucide-react';
import { api } from '../../lib/session.js';
import { can, BARANGAYS, BARANGAY_SCOPED_ROLES } from '../../../shared/roles.js';
import { Page, PageHeader, Card, Button, Field, inputClass, Modal, ErrorNote, EmptyState } from '../../components/console/ui.jsx';

// A board needs its sticker code, a name, its barangay and how high the sensor is mounted.
const EMPTY_FORM = { boardCode: '', name: '', barangay: 'Mayamot', mountHeightCm: 240 };

// The code printed on the board's sticker, e.g. 7KQ2-9XPM-H4TD
function BoardCodeInput({ value, onChange }) {
  return (
    <Field label="Board code" hint="Printed on the sticker of the board. The board must be turned on.">
      <input
        className={`${inputClass} font-mono tracking-wider uppercase`}
        value={value}
        onChange={onChange}
        placeholder="XXXX-XXXX-XXXX"
        autoComplete="off"
        spellCheck={false}
      />
    </Field>
  );
}

/** Swap board: type the sticker code of the new board for this station. */
function SwapModal({ device, onCancel, onSwap }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setError('');
    try { await onSwap(code); } catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <Modal title={`Swap board · ${device.name}`} onClose={onCancel} footer={<>
      <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      <Button onClick={save} disabled={busy || !code.trim()}>Swap</Button>
    </>}>
      <ErrorNote>{error}</ErrorNote>
      <p className="text-sm text-[#3f5361] mb-3">
        Use this when a board is broken or replaced. The new board takes over this station: its name,
        barangay, alert levels and past readings stay the same, and the old board stops working.
      </p>
      <BoardCodeInput value={code} onChange={(e) => setCode(e.target.value)} />
    </Modal>
  );
}

// One plain status per board
function statusOf(d) {
  if (d.status === 'MAINTENANCE') return { label: 'Off', style: 'bg-slate-100 text-slate-600 border-slate-200' };
  if (d.connectivity === 'ONLINE') return { label: 'Online', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  return { label: 'Offline', style: 'bg-red-50 text-red-700 border-red-200' };
}

function timeAgo(value) {
  if (!value) return 'No readings yet';
  const mins = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 1) return 'Last reading just now';
  if (mins < 60) return `Last reading ${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `Last reading ${hrs} hr ago`;
  return `Last reading ${Math.round(hrs / 24)} days ago`;
}

// Water level (m) where each alert starts. Level 3 = spill level.
const LEVELS = [
  { key: 'level1_watch',  label: 'Level 1 (Advisory)' },
  { key: 'level2_alarm',  label: 'Level 2 (Warning, siren)' },
  { key: 'level3_danger', label: 'Level 3 (Spill)' },
];

// Add (create) or Edit a board
function DeviceForm({ initial, mode, lockBarangay, showLevels, onCancel, onSubmit }) {
  const [form, setForm] = useState(() => ({
    boardCode: initial.boardCode,
    name: initial.name,
    barangay: initial.barangay,
    mountHeightCm: initial.mountHeightCm,
    levels: Object.fromEntries(LEVELS.map(({ key }) => [key, initial.thresholds?.[key] ?? ''])),
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setLevel = (k) => (e) => setForm((f) => ({ ...f, levels: { ...f.levels, [k]: e.target.value } }));

  const submit = async () => {
    setBusy(true); setError('');
    try { await onSubmit(form); } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <Modal title={mode === 'create' ? 'Add board' : `Edit ${initial.name}`} onClose={onCancel} footer={<>
      <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      <Button onClick={submit} disabled={busy}>{mode === 'create' ? 'Add board' : 'Save'}</Button>
    </>}>
      <ErrorNote>{error}</ErrorNote>
      <div className="space-y-3">
        {mode === 'create' && <BoardCodeInput value={form.boardCode} onChange={set('boardCode')} />}
        <Field label="Board name">
          <input className={inputClass} value={form.name} onChange={set('name')} placeholder="Payagwan Bridge" />
        </Field>
        <Field label="Barangay">
          <select className={inputClass} value={form.barangay} onChange={set('barangay')} disabled={lockBarangay}>
            {BARANGAYS.map((b) => <option key={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="Sensor height (cm)" hint="How high the sensor is above the dry riverbed">
          <input className={inputClass} type="number" value={form.mountHeightCm} onChange={set('mountHeightCm')} />
        </Field>
        {mode === 'edit' && showLevels && (
          <div>
            <span className="block text-xs font-semibold text-slate-700">Alert levels</span>
            <span className="block text-[11px] text-[#6d818d] mb-1.5">Water level in metres where each alert starts</span>
            <div className="space-y-2">
              {LEVELS.map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between gap-3 text-sm text-[#3f5361]">
                  <span>{label}</span>
                  <span className="relative w-28">
                    <input type="number" step="0.05" min="0" className={`${inputClass} pr-7`} value={form.levels[key]} onChange={setLevel(key)} />
                    <span className="absolute inset-y-0 right-2.5 flex items-center text-xs text-[#6d818d]">m</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function DevicesPage() {
  const { user } = useOutletContext();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null); // { mode, device }
  const [swapping, setSwapping] = useState(null);

  const canManage = can(user?.role, 'devices.manage');
  const canMaint = can(user?.role, 'devices.maintenance');
  const canLevels = can(user?.role, 'thresholds.manage');
  const scoped = BARANGAY_SCOPED_ROLES.includes(user?.role);

  const load = useCallback(async () => {
    try {
      const json = await api('/devices');
      setDevices(json.data); setError('');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  // Refresh every 10 s so Online / Offline stays current
  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (fn) => {
    try { await fn(); await load(); } catch (e) { setError(e.message); }
  };

  // Off = the board does not send alerts or sound the siren (readings are still saved)
  const toggleOn = (d) => {
    const turningOff = d.status !== 'MAINTENANCE';
    if (turningOff && !window.confirm(`Turn off ${d.name}? It will not send alerts or sound the siren until you turn it back on.`)) return;
    act(() => api(`/devices/${d.id}/maintenance`, { method: 'POST', body: { enabled: turningOff, reason: 'Turned off' } }));
  };

  // Swap = another board at the same station (old one stops working, history stays)
  const swapBoard = async (boardCode) => {
    await api(`/devices/${swapping.id}/replace`, { method: 'POST', body: { boardCode } });
    setSwapping(null);
    load();
  };

  const handleSubmit = async (form) => {
    const body = { ...form };
    if (editor.mode === 'create') {
      delete body.levels;
      await api('/devices', { method: 'POST', body });
    } else {
      const { levels } = body;
      delete body.boardCode; delete body.levels; delete body.thresholds;
      // Alert levels first: if they're invalid, nothing is saved
      const t = editor.device.thresholds || {};
      const changed = canLevels && levels && Object.keys(levels).some((k) => Number(levels[k]) !== t[k]);
      if (changed) {
        await api(`/devices/${editor.device.id}/thresholds`, {
          method: 'PUT',
          body: Object.fromEntries(Object.entries(levels).map(([k, v]) => [k, Number(v)])),
        });
      }
      await api(`/devices/${editor.device.id}`, { method: 'PUT', body });
    }
    setEditor(null);
    load();
  };

  const visible = devices.filter((d) => d.status !== 'RETIRED');

  return (
    <Page>
      <PageHeader
        title="Hardware"
        subtitle={scoped ? `Sensor boards in Barangay ${user?.barangay}.` : 'All sensor boards on the river.'}
        actions={canManage && (
          <Button onClick={() => setEditor({ mode: 'create', device: { ...EMPTY_FORM, barangay: scoped ? user.barangay : 'Mayamot' } })}>
            <Plus size={15} /> Add board
          </Button>
        )}
      />

      <ErrorNote>{error}</ErrorNote>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[#eef2f4] flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#123a54]">Stations{loading ? '' : ` · ${visible.length}`}</p>
          <p className="text-[11px] text-[#8a9ca7]">Updates automatically</p>
        </div>
        {loading ? (
          <p className="text-sm text-[#6d818d] px-4 py-8 text-center">Loading…</p>
        ) : visible.length === 0 ? (
          <EmptyState icon={Cpu} title="No boards yet">
            {canManage ? 'Turn on the board, then click “Add board” and type the code on its sticker.' : 'Ask an administrator to add a board.'}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-[#eef2f4]">
            {visible.map((d) => {
              const st = statusOf(d);
              return (
                <li key={d.id} className="px-4 py-4 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[#123a54]">{d.name}</span>
                      <span className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${st.style}`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-[#6d818d] mt-1">
                      {d.barangay}{d.boardSerial ? ` · Board ••••-••••-${d.boardSerial}` : ''} · {timeAgo(d.lastSeenAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {canMaint && (
                      <button
                        role="switch"
                        aria-checked={d.status !== 'MAINTENANCE'}
                        aria-label={`${d.name} on or off`}
                        onClick={() => toggleOn(d)}
                        className="flex items-center gap-2 px-2 text-xs font-semibold text-[#3f5361]"
                      >
                        <span className={`relative w-9 h-5 rounded-full transition-colors ${d.status !== 'MAINTENANCE' ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${d.status !== 'MAINTENANCE' ? 'left-[18px]' : 'left-0.5'}`} />
                        </span>
                        {d.status !== 'MAINTENANCE' ? 'On' : 'Off'}
                      </button>
                    )}
                    {canManage && <>
                      <Button size="sm" variant="secondary" onClick={() => setEditor({ mode: 'edit', device: { ...EMPTY_FORM, ...d } })}><Pencil size={13} /> Edit</Button>
                      <Button size="sm" variant="secondary" onClick={() => setSwapping(d)}><Replace size={13} /> Swap board</Button>
                    </>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {editor && (
        <DeviceForm
          initial={editor.device}
          mode={editor.mode}
          lockBarangay={scoped}
          showLevels={canLevels}
          onCancel={() => setEditor(null)}
          onSubmit={handleSubmit}
        />
      )}
      {swapping && <SwapModal device={swapping} onCancel={() => setSwapping(null)} onSwap={swapBoard} />}
    </Page>
  );
}
