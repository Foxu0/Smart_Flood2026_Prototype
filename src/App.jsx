import { Routes, Route, Navigate } from 'react-router-dom';
import PublicPortal     from './pages/PublicPortal.jsx';
import AdminDashboard   from './pages/AdminDashboard.jsx';
import ProtectedRoute   from './components/ProtectedRoute.jsx';
import FloodTransition  from './components/FloodTransition.jsx';
import ConsoleLayout    from './layouts/ConsoleLayout.jsx';
import DevicesPage      from './pages/console/DevicesPage.jsx';
import UsersPage        from './pages/console/UsersPage.jsx';
import SettingsPage     from './pages/console/SettingsPage.jsx';
import AuditPage        from './pages/console/AuditPage.jsx';
import PlaceholderPage  from './pages/console/PlaceholderPage.jsx';
import { STAFF_ROLES } from '../shared/roles.js';
import './index.css';

export default function App() {
  return (
    <FloodTransition>
      {(location) => (
        <Routes location={location}>
          {/* Public resident dashboard — default route, no account needed */}
          <Route path="/" element={<PublicPortal />} />

          {/* Staff console (Super Admin, MDRRMO, Barangay) — sidebar menu, role-filtered */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={STAFF_ROLES} backdrop={<AdminDashboard />}>
                <ConsoleLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="devices" element={<DevicesPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="alerts" element={
              <PlaceholderPage title="Alerts" subtitle="Active and past flood alerts across all barangays."
                planned={['Manual alert broadcast (email + SMS)', 'Alert history with acknowledgement', 'Spill / overflow detection events']} />
            } />
            <Route path="thresholds" element={
              <PlaceholderPage title="Thresholds" subtitle="Water level and current speed limits that trigger each alert level."
                planned={['Per-board water level thresholds (Advisory / Warning / Danger)', 'Current speed thresholds (m/s)', 'Spill level per site']} />
            } />
            <Route path="reports" element={
              <PlaceholderPage title="Reports" subtitle="Exportable summaries of readings, alerts and hardware health."
                planned={['Daily / weekly water level & current speed reports', 'Alert incident report (PDF / CSV)', 'Board uptime & maintenance history']} />
            } />
            <Route path="notifications" element={
              <PlaceholderPage title="Notifications" subtitle="Messages sent to staff and residents."
                planned={['SMS notification log', 'In-app notification inbox', 'Recipient groups per barangay']} />
            } />
          </Route>

          {/* Login aliases → the guarded console shows the sign-in terminal */}
          <Route path="/admin/login" element={<Navigate to="/admin" replace />} />
          <Route path="/login" element={<Navigate to="/admin" replace />} />

          {/* Catch-all — redirect to public portal */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </FloodTransition>
  );
}
