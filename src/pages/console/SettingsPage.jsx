import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../../lib/session.js';
import { ROLE_LABELS } from '../../../shared/roles.js';
import { Page, PageHeader, Card, Button, Field, inputClass, ErrorNote } from '../../components/console/ui.jsx';

function SavedNote({ children }) {
  if (!children) return null;
  return <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium px-3 py-2">{children}</div>;
}

export default function SettingsPage() {
  const { user } = useOutletContext();
  const [profile, setProfile] = useState({ fullName: user?.fullName || '', email: user?.email || '', phone: user?.phone || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [msg, setMsg] = useState({ profile: '', password: '' });
  const [err, setErr] = useState({ profile: '', password: '' });

  const saveProfile = async () => {
    setErr((e) => ({ ...e, profile: '' })); setMsg((m) => ({ ...m, profile: '' }));
    try {
      const json = await api('/auth/me', { method: 'PUT', body: profile });
      sessionStorage.setItem('sf_user', JSON.stringify(json.operator));
      setMsg((m) => ({ ...m, profile: 'Profile saved.' }));
    } catch (e) { setErr((x) => ({ ...x, profile: e.message })); }
  };

  const savePassword = async () => {
    setErr((e) => ({ ...e, password: '' })); setMsg((m) => ({ ...m, password: '' }));
    if (pw.newPassword !== pw.confirm) { setErr((x) => ({ ...x, password: 'New passwords do not match.' })); return; }
    try {
      await api('/auth/me', { method: 'PUT', body: { currentPassword: pw.currentPassword, newPassword: pw.newPassword } });
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      setMsg((m) => ({ ...m, password: 'Password changed.' }));
    } catch (e) { setErr((x) => ({ ...x, password: e.message })); }
  };

  return (
    <Page>
      <PageHeader title="Settings" subtitle={`Signed in as ${user?.username} · ${ROLE_LABELS[user?.role] || ''}${user?.barangay ? ` · ${user.barangay}` : ''}`} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-5">
          <h2 className="font-display font-bold text-[#123a54] mb-1">Profile</h2>
          <p className="text-xs text-[#6d818d] mb-4">Your mobile number is used for SMS flood alerts.</p>
          <ErrorNote>{err.profile}</ErrorNote>
          <SavedNote>{msg.profile}</SavedNote>
          <div className="space-y-3">
            <Field label="Full name"><input className={inputClass} value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} /></Field>
            <Field label="Mobile number"><input className={inputClass} value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="09171234567" /></Field>
            <Field label="Email"><input className={inputClass} type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></Field>
            <Button onClick={saveProfile}>Save profile</Button>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display font-bold text-[#123a54] mb-4">Change password</h2>
          <ErrorNote>{err.password}</ErrorNote>
          <SavedNote>{msg.password}</SavedNote>
          <div className="space-y-3">
            <Field label="Current password"><input className={inputClass} type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} autoComplete="current-password" /></Field>
            <Field label="New password" hint="At least 8 characters"><input className={inputClass} type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} autoComplete="new-password" /></Field>
            <Field label="Confirm new password"><input className={inputClass} type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" /></Field>
            <Button onClick={savePassword} disabled={!pw.currentPassword || !pw.newPassword}>Change password</Button>
          </div>
        </Card>
      </div>
    </Page>
  );
}
