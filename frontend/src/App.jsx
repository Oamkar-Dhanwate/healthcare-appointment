// ─── App Root — React Router Setup ───────────────────────────────────────────

import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastContainer } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import LoadingSpinner from './components/LoadingSpinner';

// Auth pages
import Login from './portals/auth/Login';
import Register from './portals/auth/Register';

// Patient portal
import DoctorSearch from './portals/patient/DoctorSearch';
import SlotPicker from './portals/patient/SlotPicker';
import SymptomForm from './portals/patient/SymptomForm';
import MyAppointments from './portals/patient/MyAppointments';
import PostVisitSummary from './portals/patient/PostVisitSummary';

// Doctor portal
import DoctorDashboard from './portals/doctor/Dashboard';
import AppointmentDetail from './portals/doctor/AppointmentDetail';
import ClinicalNotesForm from './portals/doctor/ClinicalNotesForm';

// Admin portal
import AdminDashboard from './portals/admin/Dashboard';
import DoctorManagement from './portals/admin/DoctorManagement';
import LeaveManagement from './portals/admin/LeaveManagement';
import AppointmentLogs from './portals/admin/AppointmentLogs';
import FailedNotifications from './portals/admin/FailedNotifications';

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div style={{ flex: 1 }}>
        <Navbar />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" />;
  const portalMap = { admin: '/admin', doctor: '/doctor', patient: '/patient' };
  return <Navigate to={portalMap[user.role] || '/login'} />;
}

export default function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('meridian-theme') || 'cream';
    document.body.className = savedTheme === 'dark' ? 'theme-dark' : savedTheme === 'light' ? 'theme-light' : 'theme-cream';
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastContainer />
        <Routes>
          {/* ── Public Routes ── */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* ── Root redirect ── */}
          <Route path="/" element={<RootRedirect />} />

          {/* ── Patient Portal ── */}
          <Route path="/patient" element={
            <ProtectedRoute roles={['patient']}>
              <AppLayout><DoctorSearch /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/patient/doctors" element={
            <ProtectedRoute roles={['patient']}>
              <AppLayout><DoctorSearch /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/patient/doctors/:id/slots" element={
            <ProtectedRoute roles={['patient']}>
              <AppLayout><SlotPicker /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/patient/symptom-form/:appointmentId" element={
            <ProtectedRoute roles={['patient']}>
              <AppLayout><SymptomForm /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/patient/appointments" element={
            <ProtectedRoute roles={['patient']}>
              <AppLayout><MyAppointments /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/patient/appointments/:id/summary" element={
            <ProtectedRoute roles={['patient']}>
              <AppLayout><PostVisitSummary /></AppLayout>
            </ProtectedRoute>
          } />

          {/* ── Doctor Portal ── */}
          <Route path="/doctor" element={
            <ProtectedRoute roles={['doctor']}>
              <AppLayout><DoctorDashboard /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/doctor/appointments" element={
            <ProtectedRoute roles={['doctor']}>
              <AppLayout><DoctorDashboard /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/doctor/appointments/:id" element={
            <ProtectedRoute roles={['doctor']}>
              <AppLayout><AppointmentDetail /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/doctor/appointments/:id/notes" element={
            <ProtectedRoute roles={['doctor']}>
              <AppLayout><ClinicalNotesForm /></AppLayout>
            </ProtectedRoute>
          } />

          {/* ── Admin Portal ── */}
          <Route path="/admin" element={
            <ProtectedRoute roles={['admin']}>
              <AppLayout><AdminDashboard /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/doctors" element={
            <ProtectedRoute roles={['admin']}>
              <AppLayout><DoctorManagement /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/doctors/new" element={
            <ProtectedRoute roles={['admin']}>
              <AppLayout><DoctorManagement /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/leaves" element={
            <ProtectedRoute roles={['admin']}>
              <AppLayout><LeaveManagement /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/appointments" element={
            <ProtectedRoute roles={['admin']}>
              <AppLayout><AppointmentLogs /></AppLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/notifications" element={
            <ProtectedRoute roles={['admin']}>
              <AppLayout><FailedNotifications /></AppLayout>
            </ProtectedRoute>
          } />

          {/* ── Calendar connected callback ── */}
          <Route path="/calendar-connected" element={
            <div className="auth-container">
              <div className="auth-card glass-card-static" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>✅</div>
                <h2 style={{ fontWeight: 700 }}>Google Calendar Connected!</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
                  Your calendar is now linked. Appointment events will be automatically synced.
                </p>
              </div>
            </div>
          } />

          {/* ── 404 ── */}
          <Route path="*" element={
            <div className="auth-container">
              <div className="auth-card glass-card-static" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>🔍</div>
                <h2 style={{ fontWeight: 700 }}>Page Not Found</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
                  The page you&apos;re looking for doesn&apos;t exist.
                </p>
                <a href="/" className="btn btn-primary" style={{ marginTop: 'var(--space-6)' }}>
                  Go Home
                </a>
              </div>
            </div>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
