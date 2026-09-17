import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import './index.css';

function ProtectedRoute({ children, allowedRole }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRole && user.role !== allowedRole) return <Navigate to={`/${user.role}`} replace />;
  return children;
}

function AppContent() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Navbar unreadCount={unreadCount} />
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/patient" element={
            <ProtectedRoute allowedRole="patient">
              <PatientDashboard onUnreadChange={setUnreadCount} />
            </ProtectedRoute>
          } />

          <Route path="/doctor" element={
            <ProtectedRoute allowedRole="doctor">
              <DoctorDashboard />
            </ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute allowedRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } />

          <Route path="/" element={
            user ? <Navigate to={`/${user.role}`} replace /> : <Navigate to="/login" replace />
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'hsl(220, 20%, 14%)',
            color: 'hsl(210, 30%, 95%)',
            border: '1px solid hsla(210, 20%, 40%, 0.28)',
            borderRadius: '10px',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.875rem',
          },
          success: {
            iconTheme: { primary: 'hsl(142, 76%, 46%)', secondary: 'white' },
          },
          error: {
            iconTheme: { primary: 'hsl(0, 90%, 60%)', secondary: 'white' },
          },
          duration: 4000,
        }}
      />
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
