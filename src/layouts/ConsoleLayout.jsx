import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Cpu, BellRing, SlidersHorizontal, FileBarChart, Bell, Users,
  ScrollText, Settings, LogOut, Menu, X, MapPin,
} from 'lucide-react';
import { api, clearSession, getUser } from '../lib/session.js';
import { can, ROLE_LABELS } from '../../shared/roles.js';

// Sidebar menu. `perm` comes from shared/roles.js — items the role can't use are hidden.
const STAFF_MENU = [
  { to: '/admin',               label: 'Dashboard',     icon: LayoutDashboard,  perm: 'dashboard.view', end: true },
  { to: '/admin/devices',       label: 'Hardware',      icon: Cpu,              perm: 'devices.view' },
  { to: '/admin/alerts',        label: 'Alerts',        icon: BellRing,         perm: 'alerts.manage' },
  { to: '/admin/thresholds',    label: 'Thresholds',    icon: SlidersHorizontal, perm: 'thresholds.manage' },
  { to: '/admin/reports',       label: 'Reports',       icon: FileBarChart,     perm: 'reports.view' },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell,             perm: 'notifications.view' },
  { to: '/admin/users',         label: 'User Accounts', icon: Users,            perm: 'users.manage' },
  { to: '/admin/audit',         label: 'Audit Log',     icon: ScrollText,       perm: 'audit.view' },
  { to: '/admin/settings',      label: 'Settings',      icon: Settings },
];

const ROLE_BADGE = {
  SUPERADMIN: 'bg-amber-100 text-amber-800 border-amber-200',
  MDRRMO:     'bg-sky-100 text-sky-800 border-sky-200',
  BARANGAY:   'bg-emerald-100 text-emerald-800 border-emerald-200',
  SYSTEM:     'bg-slate-100 text-slate-700 border-slate-200',
};

export function RoleBadge({ role }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide ${ROLE_BADGE[role] || ROLE_BADGE.SYSTEM}`}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

export default function ConsoleLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(getUser);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Refresh profile from the server (picks up role/barangay/active changes)
  useEffect(() => {
    api('/auth/me')
      .then((json) => {
        setUser(json.operator);
        sessionStorage.setItem('sf_user', JSON.stringify(json.operator));
      })
      .catch(() => { /* api() clears the session on auth errors */ });
  }, []);

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const menu = STAFF_MENU.filter((item) => !item.perm || can(user?.role, item.perm));

  const handleLogout = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* silent */ }
    clearSession();
    navigate('/', { replace: true });
  };

  const sidebar = (
    <div className="h-full flex flex-col bg-gradient-to-b from-[#123a54] to-[#0a2335] text-white">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
        <img src="/PUBMAT3.png" alt="SmartFlood logo" className="w-10 h-10 rounded-full bg-white p-0.5 object-cover border-2 border-white/50" />
        <div className="min-w-0">
          <p className="font-display font-bold leading-tight">Smart Flood</p>
          <p className="text-[11px] text-sky-200/80 truncate">EOC Command Center</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main menu">
        {menu.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive ? 'bg-white text-[#123a54] shadow-sm' : 'text-sky-100/85 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon size={17} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-white/10 space-y-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{user?.fullName || user?.username}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <RoleBadge role={user?.role} />
            {user?.barangay && (
              <span className="inline-flex items-center gap-1 text-[10px] text-sky-200/90">
                <MapPin size={10} /> {user.barangay}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-medium transition-colors"
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full flex bg-[#eef4f6]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0 sticky top-0 h-screen">{sidebar}</aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-[1000] flex">
          <div className="w-72 max-w-[85vw] h-full shadow-2xl">{sidebar}</div>
          <button className="flex-1 bg-black/40" aria-label="Close menu" onClick={() => setDrawerOpen(false)} />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-[900] bg-[#123a54] text-white flex items-center justify-between px-4 py-3 shadow">
          <button onClick={() => setDrawerOpen((v) => !v)} aria-label="Open menu" className="p-1 -ml-1">
            {drawerOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <span className="font-display font-bold">Smart Flood</span>
          <span className="w-6" />
        </header>

        <main className="flex-1 min-w-0">
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  );
}
