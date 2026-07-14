// ─── My Appointments Page ────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientApi } from '../../api/patient.api';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from '../../components/Toast';
import { HiOutlineEye, HiOutlineX } from 'react-icons/hi';

export default function MyAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { fetchAppointments(); }, []);

  async function fetchAppointments() {
    try {
      const res = await patientApi.getMyAppointments();
      setAppointments(res.data.appointments || []);
    } catch {
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(id) {
    if (!confirm('Cancel this appointment?')) return;
    try {
      await patientApi.cancelAppointment(id);
      toast.success('Appointment cancelled');
      fetchAppointments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Cancel failed');
    }
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const formatTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  if (loading) return <LoadingSpinner fullPage text="Loading appointments..." />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Appointments</h1>
          <p className="page-subtitle">View and manage your bookings</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/patient/doctors')}>
          Book New Appointment
        </button>
      </div>

      {appointments.length === 0 ? (
        <div className="empty-state glass-card-static">
          <div className="empty-icon">📋</div>
          <div className="empty-title">No Appointments</div>
          <div className="empty-message">You haven&apos;t booked any appointments yet.</div>
        </div>
      ) : (
        <div className="glass-card-static" style={{ overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
                <th>Urgency</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((apt) => (
                <tr key={apt.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>Dr. {apt.doctor?.user?.fullName}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      {apt.doctor?.specialisation}
                    </div>
                  </td>
                  <td>{formatDate(apt.slotStart)}</td>
                  <td>{formatTime(apt.slotStart)}</td>
                  <td><span className={`badge badge-${apt.status}`}>{apt.status}</span></td>
                  <td>
                    {apt.symptomForm?.urgencyLevel ? (
                      <span className={`badge badge-urgency-${apt.symptomForm.urgencyLevel}`}>
                        {apt.symptomForm.urgencyLevel}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      {apt.status === 'completed' && apt.visitNote && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => navigate(`/patient/appointments/${apt.id}/summary`)}
                          title="View Summary"
                        >
                          <HiOutlineEye size={16} />
                        </button>
                      )}
                      {(apt.status === 'held' || apt.status === 'confirmed') && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleCancel(apt.id)}
                          title="Cancel"
                        >
                          <HiOutlineX size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
