import { Routes, Route, Navigate } from 'react-router-dom';
import PublicPortal     from './pages/PublicPortal.jsx';
import AdminLogin       from './pages/AdminLogin.jsx';
import AdminDashboard   from './pages/AdminDashboard.jsx';
import ProtectedRoute   from './components/ProtectedRoute.jsx';
import './index.css';

export default function App() {
  return (
    <Routes>
      {/* Public citizen portal — default route */}
      <Route path="/" element={<PublicPortal />} />

      {/* Admin login — accessible without auth */}
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Admin EOC dashboard — protected by JWT guard */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Catch-all — redirect to public portal */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
