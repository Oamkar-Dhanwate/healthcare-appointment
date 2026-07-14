// ─── Login Page ──────────────────────────────────────────────────────────────

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from '../../components/Toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, Dr./Mr. ${user.fullName}!`);
      const portalMap = { admin: '/admin', doctor: '/doctor', patient: '/patient' };
      navigate(portalMap[user.role] || '/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" style={{ background: 'var(--bg-primary)' }}>
      <div className="auth-card glass-card-static" style={{ borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)' }}>
        
        {/* Brand Logo Header */}
        <div className="auth-header" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', justifyContent: 'center', marginBottom: '16px' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '6px',
              background: '#063327',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FAF6F0',
              fontWeight: 700,
              fontFamily: 'var(--font-family-serif)',
              fontSize: '1.25rem',
            }}>
              M
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontWeight: 600, fontSize: '1.25rem', color: 'var(--text-primary)', fontFamily: 'var(--font-family-serif)' }}>
                Meridian
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Health
              </span>
            </div>
          </div>
          <h1 className="serif-title" style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '8px' }}>Welcome Back</h1>
          <p className="auth-subtitle" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Sign in to your personalized healthcare portal
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 'var(--space-4)', borderRadius: 'var(--radius-full)' }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Demo log in shortcuts */}
        <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--glass-border)' }}>
          <h4 style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', marginBottom: 'var(--space-3)' }}>
            Quick Demo Logins
          </h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, padding: '6px 8px', fontSize: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}
              onClick={() => {
                setEmail('patient@healthcare.com');
                setPassword('password123');
              }}
            >
              Patient
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, padding: '6px 8px', fontSize: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}
              onClick={() => {
                setEmail('doctor@healthcare.com');
                setPassword('password123');
              }}
            >
              Doctor
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, padding: '6px 8px', fontSize: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}
              onClick={() => {
                setEmail('admin@healthcare.com');
                setPassword('password123');
              }}
            >
              Admin
            </button>
          </div>
        </div>

        <div className="auth-footer" style={{ marginTop: 'var(--space-6)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>
          Don&apos;t have an account? <Link to="/register" style={{ fontWeight: 600 }}>Register here</Link>
        </div>
      </div>
    </div>
  );
}
