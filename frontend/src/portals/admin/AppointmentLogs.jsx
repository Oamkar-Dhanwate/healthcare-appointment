// ─── Appointment Logs Page ───────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { adminApi } from '../../api/admin.api';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function AppointmentLogs() {
  const [appointments, setAppointments] = useState([]);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState({ status: '', date: '', page: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAppointments(); }, [filters]);

  async function fetchAppointments() {
    setLoading(true);
    try {
      const params = { page: filters.page, limit: 20 };
      if (filters.status) params.status = filters.status;
      if (filters.date) params.date = filters.date;
      const res = await adminApi.listAppointments(params);
      setAppointments(res.data.appointments || []);
      setPagination(res.data.pagination || {});
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const formatTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">All Appointments</h1>
          <p className="page-subtitle">{pagination.total || 0} total appointment records</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card-static" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-6)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'end' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Status</label>
          <select className="form-select" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}>
            <option value="">All</option>
            <option value="held">Held</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="leave_cancelled">Leave Cancelled</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Date</label>
          <input type="date" className="form-input" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value, page: 1 })} />
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setFilters({ status: '', date: '', page: 1 })}>
          Clear Filters
        </button>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading appointments..." />
      ) : appointments.length === 0 ? (
        <div className="empty-state glass-card-static">
          <div className="empty-icon">📋</div>
          <div className="empty-title">No appointments found</div>
        </div>
      ) : (
        <>
          <div className="glass-card-static" style={{ overflow: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Urgency</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((apt) => (
                  <tr key={apt.id}>
                    <td style={{ color: 'var(--text-muted)' }}>#{apt.id}</td>
                    <td style={{ fontWeight: 500 }}>{apt.patient?.fullName}</td>
                    <td>Dr. {apt.doctor?.user?.fullName}</td>
                    <td>{formatDate(apt.slotStart)}</td>
                    <td>{formatTime(apt.slotStart)}</td>
                    <td><span className={`badge badge-${apt.status}`}>{apt.status}</span></td>
                    <td>
                      {apt.symptomForm?.urgencyLevel ? (
                        <span className={`badge badge-urgency-${apt.symptomForm.urgencyLevel}`}>{apt.symptomForm.urgencyLevel}</span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-6)' }}>
              {Array.from({ length: pagination.totalPages }, (_, i) => (
                <button
                  key={i}
                  className={`btn ${filters.page === i + 1 ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setFilters({ ...filters, page: i + 1 })}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
