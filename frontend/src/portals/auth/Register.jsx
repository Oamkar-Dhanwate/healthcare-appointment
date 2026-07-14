// ─── Register Page ───────────────────────────────────────────────────────────

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from '../../components/Toast';

export default function Register() {
  const SPECIALISATIONS = [
    'Cardiology',
    'Dermatology',
    'Endocrinology',
    'Gastroenterology',
    'General Practice',
    'Gynaecology',
    'Nephrology',
    'Neurology',
    'Oncology',
    'Ophthalmology',
    'Orthopaedics',
    'Paediatrics',
    'Psychiatry',
    'Pulmonology',
    'Radiology',
    'Rheumatology',
    'Surgery',
    'Urology',
  ];

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: 'patient',
    specialisation: '',
  });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      return toast.error('Passwords do not match');
    }

    if (form.password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }

    if (form.role === 'doctor' && !form.specialisation) {
      return toast.error('Please select a specialisation');
    }

    setLoading(true);
    try {
      const user = await register({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        phone: form.phone,
        role: form.role,
        ...(form.role === 'doctor' && { specialisation: form.specialisation }),
      });
      toast.success(`Welcome, ${user.fullName}! Your account has been created.`);
      const portalMap = { admin: '/admin', doctor: '/doctor', patient: '/patient' };
      navigate(portalMap[user.role] || '/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" style={{ background: 'var(--bg-primary)' }}>
      <div className="auth-card glass-card-static" style={{ maxWidth: 500, borderRadius: 'var(--radius-xl)', padding: 'var(--space-8)' }}>
        
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
          <h1 className="serif-title" style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '8px' }}>Create Account</h1>
          <p className="auth-subtitle" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', textAlign: 'center' }}>
            Join the Meridian Health network
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-name">Full Name</label>
            <input
              id="reg-name"
              name="fullName"
              type="text"
              className="form-input"
              placeholder="John Doe"
              value={form.fullName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email Address</label>
            <input
              id="reg-email"
              name="email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-phone">Phone (optional)</label>
            <input
              id="reg-phone"
              name="phone"
              type="tel"
              className="form-input"
              placeholder="+91 9876543210"
              value={form.phone}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-role">Register as</label>
            <select
              id="reg-role"
              name="role"
              className="form-select"
              value={form.role}
              onChange={handleChange}
            >
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Specialisation — shown only when role is doctor */}
          {form.role === 'doctor' && (
            <div className="form-group">
              <label className="form-label" htmlFor="reg-specialisation">Specialisation</label>
              <select
                id="reg-specialisation"
                name="specialisation"
                className="form-select"
                value={form.specialisation}
                onChange={handleChange}
                required
              >
                <option value="">Select specialisation…</option>
                {SPECIALISATIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                name="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-confirm">Confirm</label>
              <input
                id="reg-confirm"
                name="confirmPassword"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={form.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: 'var(--space-4)', borderRadius: 'var(--radius-full)' }}
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer" style={{ marginTop: 'var(--space-6)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>
          Already have an account? <Link to="/login" style={{ fontWeight: 600 }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
