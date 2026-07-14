// ─── Doctor Management Page ──────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/admin.api';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from '../../components/Toast';

const DEFAULT_WORKING_HOURS = {
  mon: ['10:00', '17:00'],
  tue: ['10:00', '17:00'],
  wed: ['10:00', '17:00'],
  thu: ['10:00', '17:00'],
  fri: ['10:00', '17:00'],
};

export default function DoctorManagement() {
  const navigate = useNavigate();
  const isNew = window.location.pathname.includes('/new');
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [form, setForm] = useState({
    email: '', password: '', fullName: '', phone: '',
    specialisation: '', slotDurationMin: 15,
    consultationFee: '', workingHours: DEFAULT_WORKING_HOURS,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isNew) fetchDoctors();
  }, []);

  async function fetchDoctors() {
    try {
      const res = await adminApi.listDoctors();
      setDoctors(res.data.doctors || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminApi.createDoctor({
        ...form,
        slotDurationMin: Number(form.slotDurationMin),
        consultationFee: form.consultationFee ? Number(form.consultationFee) : null,
      });
      toast.success('Doctor profile created!');
      navigate('/admin/doctors');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create doctor');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Create Doctor Form ──
  if (isNew) {
    return (
      <div className="page-container" style={{ maxWidth: 700, margin: '0 auto' }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Add New Doctor</h1>
            <p className="page-subtitle">Create a doctor account with working hours</p>
          </div>
        </div>

        <div className="glass-card-static" style={{ padding: 'var(--space-8)' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input name="fullName" className="form-input" value={form.fullName} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input name="email" type="email" className="form-input" value={form.email} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input name="password" type="password" className="form-input" value={form.password} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input name="phone" className="form-input" value={form.phone} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Specialisation *</label>
                <input name="specialisation" className="form-input" placeholder="e.g. Cardiology" value={form.specialisation} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">Slot Duration (min)</label>
                <input name="slotDurationMin" type="number" className="form-input" value={form.slotDurationMin} onChange={handleChange} min="5" />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Consultation Fee (₹)</label>
                <input name="consultationFee" type="number" className="form-input" placeholder="Optional" value={form.consultationFee} onChange={handleChange} />
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>
                📅 Default working hours: Mon–Fri, 10:00–17:00
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                Working hours can be customized after creation via the edit screen.
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 'var(--space-6)' }} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Doctor Profile'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Doctor List ──
  if (loading) return <LoadingSpinner fullPage text="Loading doctors..." />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Doctor Management</h1>
          <p className="page-subtitle">{doctors.length} doctor(s) registered</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/admin/doctors/new')}>
          + Add Doctor
        </button>
      </div>

      {doctors.length === 0 ? (
        <div className="empty-state glass-card-static">
          <div className="empty-icon">👨‍⚕️</div>
          <div className="empty-title">No Doctors</div>
          <div className="empty-message">Add your first doctor to get started.</div>
        </div>
      ) : (
        <div className="glass-card-static" style={{ overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Specialisation</th>
                <th>Slot Duration</th>
                <th>Fee</th>
                <th>Appointments</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>Dr. {doc.user?.fullName}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{doc.user?.email}</div>
                  </td>
                  <td><span className="badge badge-confirmed" style={{ textTransform: 'none' }}>{doc.specialisation}</span></td>
                  <td>{doc.slotDurationMin} min</td>
                  <td>{doc.consultationFee ? `₹${Number(doc.consultationFee).toLocaleString()}` : '—'}</td>
                  <td>{doc._count?.appointments || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
