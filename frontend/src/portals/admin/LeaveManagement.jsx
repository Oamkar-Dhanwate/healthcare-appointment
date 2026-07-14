// ─── Leave Management Page ───────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { adminApi } from '../../api/admin.api';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from '../../components/Toast';
import Modal from '../../components/Modal';

export default function LeaveManagement() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [leaveDate, setLeaveDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchDoctors(); }, []);

  async function fetchDoctors() {
    try {
      const res = await adminApi.listDoctors();
      setDoctors(res.data.doctors || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  const openLeaveModal = (doctor) => {
    setSelectedDoctor(doctor);
    setLeaveDate('');
    setReason('');
    setShowModal(true);
  };

  const handleMarkLeave = async (e) => {
    e.preventDefault();
    if (!leaveDate) return toast.error('Please select a date');
    setSubmitting(true);
    try {
      const res = await adminApi.markLeave(selectedDoctor.id, { leaveDate, reason });
      const cancelled = res.data.cancelledAppointments;
      if (cancelled > 0) {
        toast.success(`Leave marked. ${cancelled} appointment(s) cancelled and patients notified.`);
      } else {
        toast.success('Leave marked successfully.');
      }
      setShowModal(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to mark leave');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage text="Loading doctors..." />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Leave Management</h1>
          <p className="page-subtitle">Mark doctor leave days. Conflicting appointments will be auto-cancelled.</p>
        </div>
      </div>

      <div className="glass-card-static" style={{ overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Doctor</th>
              <th>Specialisation</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {doctors.map((doc) => (
              <tr key={doc.id}>
                <td style={{ fontWeight: 600 }}>Dr. {doc.user?.fullName}</td>
                <td>{doc.specialisation}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openLeaveModal(doc)}>
                    Mark Leave
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={`Mark Leave — Dr. ${selectedDoctor?.user?.fullName}`}>
        <form onSubmit={handleMarkLeave}>
          <div style={{
            padding: 'var(--space-4)', marginBottom: 'var(--space-4)',
            background: 'var(--warning-bg)', borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(251, 191, 36, 0.2)',
            fontSize: 'var(--font-size-sm)', color: 'var(--warning)',
          }}>
            ⚠️ If there are confirmed appointments on this date, they will be automatically cancelled and patients will be notified.
          </div>

          <div className="form-group">
            <label className="form-label">Leave Date *</label>
            <input
              type="date"
              className="form-input"
              value={leaveDate}
              onChange={(e) => setLeaveDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Reason (optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Personal, Conference, etc."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
            {submitting ? 'Marking Leave...' : 'Confirm Leave'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
