import { Routes, Route, Navigate } from 'react-router-dom';
import PublicPortal     from './pages/PublicPortal.jsx';
import AdminDashboard   from './pages/AdminDashboard.jsx';
import ProtectedRoute   from './components/ProtectedRoute.jsx';
import FloodTransition  from './components/FloodTransition.jsx';
import ConsoleLayout    from './layouts/ConsoleLayout.jsx';
import DevicesPage      from './pages/console/DevicesPage.jsx';
import UsersPage        from './pages/console/UsersPage.jsx';
import AlertsPage       from './pages/console/AlertsPage.jsx';
import ReportsPage      from './pages/console/ReportsPage.jsx';
import MonitoringPage   from './pages/console/MonitoringPage.jsx';
import { getUser } from './lib/session.js';
import { STAFF_ROLES, ROLES } from '../shared/roles.js';

// Each role's home: Super Admin manages the system (starts on Hardware); CDRRMO and Barangay staff watch the river
function RoleHome() {
  return getUser()?.role === ROLES.SUPERADMIN ? <Navigate to="/admin/devices" replace /> : <MonitoringPage />;
}
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
            <Route index element={<RoleHome />} />
            <Route path="devices" element={<DevicesPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            {/* Old menu items, now merged */}
            <Route path="thresholds" element={<Navigate to="/admin/devices" replace />} />
            <Route path="settings" element={<Navigate to="/admin" replace />} />
            <Route path="notifications" element={<Navigate to="/admin/alerts" replace />} />
            <Route path="audit" element={<Navigate to="/admin/reports" replace />} />
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
