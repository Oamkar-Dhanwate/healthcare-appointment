// ─── Navbar Component ────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import authApi from '../api/auth.api';
import Modal from './Modal';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('meridian-theme') || 'cream');

  const handleLogout = () => {
    setIsSettingsOpen(false);
    logout();
    navigate('/login');
  };

  const getGoogleAuth = async () => {
    try {
      const { data } = await authApi.getGoogleAuthUrl();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error('Failed to get Google Auth URL', err);
    }
  };

  const currentPath = location.pathname;

  // Active tab check
  const isActive = (path) => {
    if (path === '/overview') {
      return currentPath === '/' || currentPath === '/overview';
    }
    return currentPath.startsWith(path);
  };

  const tabStyle = (active) => ({
    padding: '6px 16px',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 500,
    color: 'var(--text-primary)',
    background: active ? 'var(--bg-tertiary)' : 'transparent',
    transition: 'background var(--transition-fast)',
    textDecoration: 'none',
    cursor: 'pointer',
  });

  // Apply theme when modified in settings modal
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('meridian-theme', newTheme);
    document.body.className = newTheme === 'dark' ? 'theme-dark' : newTheme === 'light' ? 'theme-light' : 'theme-cream';
  };

  return (
    <>
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 'var(--navbar-height)',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--glass-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-8)',
        zIndex: 100,
      }}>
        {/* Brand Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', textDecoration: 'none' }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '6px',
            background: '#063327',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FAF6F0',
            fontWeight: 700,
            fontFamily: 'var(--font-family-serif)',
            fontSize: '1.1rem',
          }}>
            M
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontWeight: 600, fontSize: '1.15rem', color: 'var(--text-primary)', fontFamily: 'var(--font-family-serif)' }}>
              Meridian
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Health
            </span>
          </div>
        </Link>

        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link to="/" style={tabStyle(isActive('/overview'))}>Overview</Link>
          <Link to="/patient" style={tabStyle(isActive('/patient'))}>Patient</Link>
          <Link to="/doctor" style={tabStyle(isActive('/doctor'))}>Doctor</Link>
          <Link to="/admin" style={tabStyle(isActive('/admin'))}>Admin</Link>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user ? (
            <>
              {/* Show Connect Calendar if patient or doctor */}
              {(user.role === 'doctor' || user.role === 'patient') && (
                <button
                  onClick={getGoogleAuth}
                  className="btn btn-secondary btn-sm"
                  style={{ border: '1px solid var(--glass-border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  title="Connect Google Calendar"
                >
                  Sync Calendar
                </button>
              )}

              {/* Account / Settings button */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: '1px solid var(--glass-border)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontWeight: 600
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: 'var(--accent-gradient)',
                  color: '#fff', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {user.fullName?.[0]?.toUpperCase()}
                </div>
                Settings
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-secondary btn-sm" style={{ padding: '8px 18px', fontSize: 'var(--font-size-sm)' }}>
              Sign in
            </Link>
          )}

          <Link
            to="/patient/doctors"
            className="btn btn-primary btn-sm"
            style={{ padding: '8px 18px', fontSize: 'var(--font-size-sm)' }}
          >
            Book a visit
          </Link>
        </div>
      </nav>

      {/* Account & Settings Modal */}
      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Account & Settings"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Profile Section */}
          <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--glass-border)' }}>
            <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', letterSpacing: '0.04em' }}>
              Profile details
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--font-size-sm)' }}>
              <div><strong>Name:</strong> {user?.fullName}</div>
              <div><strong>Email:</strong> {user?.email}</div>
              {user?.phone && <div><strong>Phone:</strong> {user.phone}</div>}
              <div><strong>Role:</strong> <span style={{ textTransform: 'capitalize' }}>{user?.role}</span></div>
            </div>
          </div>

          {/* Theme Switcher Section */}
          <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--glass-border)' }}>
            <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', letterSpacing: '0.04em' }}>
              Theme preferences
            </h4>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[
                { name: 'cream', label: 'Meridian Cream' },
                { name: 'light', label: 'Clean Light' },
                { name: 'dark', label: 'Dark Mode' }
              ].map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => handleThemeChange(t.name)}
                  className="btn"
                  style={{
                    flex: 1,
                    fontSize: '0.8rem',
                    padding: '8px 12px',
                    background: theme === t.name ? 'var(--text-primary)' : 'var(--bg-tertiary)',
                    color: theme === t.name ? 'var(--bg-secondary)' : 'var(--text-primary)',
                    border: 'none',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={handleLogout}
              className="btn btn-danger"
              style={{ padding: '8px 20px', width: '100%' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
