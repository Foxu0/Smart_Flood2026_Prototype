import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Users, UserPlus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { api } from '../../lib/session.js';
import { MANAGEABLE_ROLES, ROLE_LABELS, BARANGAYS, ROLES } from '../../../shared/roles.js';
import { RoleBadge } from '../../layouts/ConsoleLayout.jsx';
import { Page, PageHeader, Card, Button, Field, inputClass, Modal, ErrorNote, EmptyState, formatDateTime } from '../../components/console/ui.jsx';

const EMPTY = { username: '', password: '', fullName: '', email: '', phone: '', role: ROLES.BARANGAY, barangay: 'Mayamot', isActive: true };

function UserForm({ initial, creating, roleOptions, onCancel, onSubmit }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const needsBarangay = form.role === ROLES.BARANGAY;

  const submit = async () => {
    setBusy(true); setError('');
    const body = { ...form, barangay: needsBarangay ? form.barangay : null };
    if (!creating) { delete body.username; if (!body.password) delete body.password; }
    try { await onSubmit(body); } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <Modal title={creating ? 'Create account' : `Edit ${initial.username}`} onClose={onCancel} wide footer={<>
      <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      <Button onClick={submit} disabled={busy}>{creating ? 'Create account' : 'Save changes'}</Button>
    </>}>
      <ErrorNote>{error}</ErrorNote>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Role">
          <select className={inputClass} value={form.role} onChange={set('role')}>
            {roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </Field>
        {needsBarangay ? (
          <Field label="Barangay" hint="Staff only see hardware and reports for this barangay">
            <select className={inputClass} value={form.barangay || 'Mayamot'} onChange={set('barangay')}>
              {BARANGAYS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </Field>
        ) : <div className="hidden sm:block" />}
        <Field label="Username">
          <input className={inputClass} value={form.username} onChange={set('username')} disabled={!creating} autoComplete="off" />
        </Field>
        <Field label={creating ? 'Password' : 'Reset password'} hint={creating ? 'At least 8 characters' : 'Leave blank to keep the current password'}>
          <input className={inputClass} type="password" value={form.password || ''} onChange={set('password')} autoComplete="new-password" />
        </Field>
        <Field label="Full name">
          <input className={inputClass} value={form.fullName || ''} onChange={set('fullName')} />
        </Field>
        <Field label="Mobile number" hint="For SMS alerts, e.g. 09171234567">
          <input className={inputClass} value={form.phone || ''} onChange={set('phone')} />
        </Field>
        <Field label="Email">
          <input className={inputClass} type="email" value={form.email || ''} onChange={set('email')} />
        </Field>
        {!creating && (
          <label className="flex items-center gap-2 text-sm text-[#3f5361] self-end pb-2">
            <input type="checkbox" checked={form.isActive} onChange={set('isActive')} /> Account active
          </label>
        )}
      </div>
    </Modal>
  );
}

export default function UsersPage() {
  const { user } = useOutletContext();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [editor, setEditor] = useState(null); // { creating, user }

  const roleOptions = MANAGEABLE_ROLES[user?.role] || [];

  const load = useCallback(async () => {
    setLoading(true);
    try { const json = await api('/users'); setUsers(json.data); setError(''); } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

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

  const visible = users.filter((u) => filter === 'ALL' || u.role === filter);

  return (
    <Page>
      <PageHeader
        title="User Accounts"
        subtitle={user?.role === ROLES.SUPERADMIN
          ? 'Create and manage Super Admin, MDRRMO and Barangay DRRM staff accounts. Residents use the public dashboard without an account.'
          : 'Create and manage Barangay DRRM staff accounts.'}
        actions={<>
          <Button variant="secondary" onClick={load}><RefreshCw size={15} /> Refresh</Button>
          <Button onClick={() => setEditor({ creating: true, user: { ...EMPTY, role: roleOptions.includes(ROLES.BARANGAY) ? ROLES.BARANGAY : roleOptions[0] } })}>
            <UserPlus size={15} /> New account
          </Button>
        </>}
      />

      <div className="flex flex-wrap gap-1.5 mb-4">
        {['ALL', ...roleOptions].map((r) => (
          <button key={r} onClick={() => setFilter(r)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border ${filter === r ? 'bg-[#123a54] text-white border-[#123a54]' : 'bg-white text-[#3f5361] border-[#d5e2e7] hover:bg-[#f4f8f9]'}`}>
            {r === 'ALL' ? `All (${users.length})` : `${ROLE_LABELS[r]} (${users.filter((u) => u.role === r).length})`}
          </button>
        ))}
      </div>

      <ErrorNote>{error}</ErrorNote>

      <Card className="overflow-hidden">
        {loading ? (
          <p className="text-sm text-[#6d818d] px-4 py-8 text-center">Loading accounts…</p>
        ) : visible.length === 0 ? (
          <EmptyState icon={Users} title="No accounts in this group" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f6f9fa] text-[11px] uppercase tracking-wide text-[#6d818d]">
                <tr>
                  <th className="text-left font-bold px-4 py-2.5">Account</th>
                  <th className="text-left font-bold px-4 py-2.5">Role</th>
                  <th className="text-left font-bold px-4 py-2.5 hidden md:table-cell">Barangay</th>
                  <th className="text-left font-bold px-4 py-2.5 hidden lg:table-cell">Contact</th>
                  <th className="text-left font-bold px-4 py-2.5 hidden md:table-cell">Last sign-in</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f4]">
                {visible.map((u) => (
                  <tr key={u.id} className={u.isActive ? '' : 'opacity-50'}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#123a54]">{u.fullName || u.username}</p>
                      <p className="text-[11px] text-[#6d818d] font-mono">{u.username}{!u.isActive && ' · disabled'}</p>
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-3 hidden md:table-cell text-[#3f5361]">{u.barangay || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-[11px] text-[#6d818d]">{[u.phone, u.email].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-[11px] text-[#6d818d]">{formatDateTime(u.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditor({ creating: false, user: { ...u, password: '' } })} aria-label={`Edit ${u.username}`}><Pencil size={14} /></Button>
                        {u.id !== user?.id && (
                          <Button size="sm" variant="ghost" onClick={() => remove(u)} aria-label={`Delete ${u.username}`}><Trash2 size={14} /></Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
