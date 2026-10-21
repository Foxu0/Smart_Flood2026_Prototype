import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { UserPlus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../lib/session.js';
import { MANAGEABLE_ROLES, ROLE_LABELS, BARANGAYS, ROLES } from '../../../shared/roles.js';
import { Page, PageHeader, Card, Button, Field, inputClass, Modal, ErrorNote } from '../../components/console/ui.jsx';

const EMPTY = { username: '', password: '', fullName: '', role: ROLES.BARANGAY, barangay: 'Mayamot' };

function UserForm({ initial, creating, roleOptions, onCancel, onSubmit }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isBarangay = form.role === ROLES.BARANGAY;

  const submit = async () => {
    setBusy(true); setError('');
    const body = {
      fullName: form.fullName,
      role: form.role,
      barangay: isBarangay ? form.barangay : null,
      ...(creating ? { username: form.username } : {}),
      ...(form.password ? { password: form.password } : {}),
    };
    try { await onSubmit(body); } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <Modal title={creating ? 'New account' : `Edit ${initial.fullName || initial.username}`} onClose={onCancel} footer={<>
      <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      <Button onClick={submit} disabled={busy}>{creating ? 'Create account' : 'Save'}</Button>
    </>}>
      <ErrorNote>{error}</ErrorNote>
      <div className="space-y-3">
        <Field label="Full name">
          <input className={inputClass} value={form.fullName || ''} onChange={set('fullName')} placeholder="Juan Dela Cruz" />
        </Field>
        {roleOptions.length > 1 && (
          <Field label="Role">
            <select className={inputClass} value={form.role} onChange={set('role')}>
              {roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </Field>
        )}
        {isBarangay && (
          <Field label="Barangay">
            <select className={inputClass} value={form.barangay || 'Mayamot'} onChange={set('barangay')}>
              {BARANGAYS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </Field>
        )}
        {creating && (
          <Field label="Username" hint="Used to sign in, e.g. brgy.dalig">
            <input className={inputClass} value={form.username} onChange={set('username')} autoComplete="off" />
          </Field>
        )}
        <Field label={creating ? 'Password' : 'New password'} hint={creating ? 'At least 8 characters' : 'Leave blank to keep the current one'}>
          <input className={inputClass} type="password" value={form.password || ''} onChange={set('password')} autoComplete="new-password" />
        </Field>
      </div>
    </Modal>
  );
}

export default function UsersPage() {
  const { user } = useOutletContext();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null); // { creating, user }
  const [show, setShow] = useState('ALL'); // ALL | MDRRMO | BARANGAY

  const roleOptions = MANAGEABLE_ROLES[user?.role] || [];

  const load = useCallback(async () => {
    try { const json = await api('/users'); setUsers(json.data); setError(''); } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = users.filter((u) => show === 'ALL' || u.role === show);

  const handleSubmit = async (body) => {
    if (editor.creating) await api('/users', { method: 'POST', body });
    else await api(`/users/${editor.user.id}`, { method: 'PUT', body });
    setEditor(null);
    load();
  };

  const remove = async (u) => {
    if (!window.confirm(`Delete the account "${u.username}"? This cannot be undone.`)) return;
    try { await api(`/users/${u.id}`, { method: 'DELETE' }); load(); } catch (e) { setError(e.message); }
  };

  return (
    <Page>
      <PageHeader
        title="Users"
        subtitle="Staff who can sign in. Residents don't need an account."
        actions={
          <Button onClick={() => setEditor({ creating: true, user: { ...EMPTY, role: roleOptions.includes(ROLES.BARANGAY) ? ROLES.BARANGAY : roleOptions[0] } })}>
            <UserPlus size={15} /> New account
          </Button>
        }
      />
      <ErrorNote>{error}</ErrorNote>

      {roleOptions.length > 1 && (
        <div className="flex gap-1.5 mb-3">
          {[['ALL', 'All'], [ROLES.MDRRMO, 'CDRRMO'], [ROLES.BARANGAY, 'Barangay']].map(([key, label]) => (
            <button key={key} onClick={() => setShow(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${show === key ? 'bg-[#123a54] text-white border-[#123a54]' : 'bg-white text-[#3f5361] border-[#d5e2e7] hover:bg-[#f4f8f9]'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      <Card>
        {loading ? (
          <p className="text-sm text-[#6d818d] px-4 py-8 text-center">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-[#6d818d] px-4 py-8 text-center">No accounts yet. Click “New account” to add one.</p>
        ) : (
          <ul className="divide-y divide-[#eef2f4]">
            {shown.map((u) => (
              <li key={u.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#123a54] truncate">{u.fullName || u.username}</p>
                  <p className="text-xs text-[#6d818d] truncate">
                    {u.username} · {ROLE_LABELS[u.role] || u.role}{u.barangay ? ` · ${u.barangay}` : ''}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setEditor({ creating: false, user: { ...u, password: '' } })}><Pencil size={13} /> Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(u)} aria-label={`Delete ${u.username}`}><Trash2 size={14} /></Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editor && (
        <UserForm
          initial={editor.user}
          creating={editor.creating}
          roleOptions={roleOptions}
          onCancel={() => setEditor(null)}
          onSubmit={handleSubmit}
        />
      )}
    </Page>
  );
}
