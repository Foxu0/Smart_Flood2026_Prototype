import { Routes, Route, Navigate } from 'react-router-dom';
import PublicPortal     from './pages/PublicPortal.jsx';
import AdminLogin       from './pages/AdminLogin.jsx';
import AdminDashboard   from './pages/AdminDashboard.jsx';
import ProtectedRoute   from './components/ProtectedRoute.jsx';
import FloodTransition  from './components/FloodTransition.jsx';
import './index.css';

export default function App() {
  return (
    <FloodTransition>
      {(location) => (
        <Routes location={location}>
          {/* Public citizen portal — default route */}
          <Route path="/" element={<PublicPortal />} />

          {/* Admin EOC dashboard — guarded by ProtectedRoute pop-up */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Redirect /admin/login to /admin */}
          <Route path="/admin/login" element={<Navigate to="/admin" replace />} />


          {/* Catch-all — redirect to public portal */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </FloodTransition>
  );
}

