// ─── Appointment Detail View ─────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doctorApi } from '../../api/doctor.api';
import LoadingSpinner from '../../components/LoadingSpinner';
import { HiOutlineArrowLeft } from 'react-icons/hi';

export default function AppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const res = await doctorApi.getAppointmentDetail(id);
        setAppointment(res.data.appointment);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [id]);

  if (loading) return <LoadingSpinner fullPage text="Loading appointment..." />;
  if (!appointment) return <div className="page-container"><p>Appointment not found</p></div>;

  const sf = appointment.symptomForm;
  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const formatTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="page-container" style={{ maxWidth: 800, margin: '0 auto' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 'var(--space-4)' }}>
        <HiOutlineArrowLeft /> Back
      </button>

      {/* Patient Info */}
      <div className="glass-card-static" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div>
            <h1 style={{ fontWeight: 700, fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-2)' }}>
              {appointment.patient?.fullName}
            </h1>
            <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
              <span>📅 {formatDate(appointment.slotStart)}</span>
              <span>🕐 {formatTime(appointment.slotStart)} — {formatTime(appointment.slotEnd)}</span>
              {appointment.patient?.email && <span>✉️ {appointment.patient.email}</span>}
              {appointment.patient?.phone && <span>📞 {appointment.patient.phone}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <span className={`badge badge-${appointment.status}`}>{appointment.status}</span>
            {sf?.urgencyLevel && (
              <span className={`badge badge-urgency-${sf.urgencyLevel}`}>{sf.urgencyLevel}</span>
            )}
          </div>
        </div>
      </div>

      {/* AI Pre-Visit Summary */}
      {sf && (
        <div className="glass-card-static" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <h2 style={{ fontWeight: 700, marginBottom: 'var(--space-5)' }}>🤖 AI Pre-Visit Summary</h2>

          <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Chief Complaint
              </div>
              <div style={{ fontWeight: 600, fontSize: 'var(--font-size-lg)' }}>
                {sf.chiefComplaint || 'Not available'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
              <div style={{ padding: 'var(--space-3)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Duration</div>
                <div style={{ fontWeight: 600 }}>{sf.durationDays ? `${sf.durationDays} days` : '—'}</div>
              </div>
              <div style={{ padding: 'var(--space-3)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Severity</div>
                <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{sf.severity || '—'}</div>
              </div>
              <div style={{ padding: 'var(--space-3)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>AI Status</div>
                <div style={{ fontWeight: 600, textTransform: 'capitalize', color: sf.aiStatus === 'ok' ? 'var(--success)' : 'var(--warning)' }}>
                  {sf.aiStatus}
                </div>
              </div>
            </div>

            {sf.suggestedQuestions?.length > 0 && (
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Suggested Questions to Ask
                </div>
                <ul style={{ paddingLeft: '16px', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.8 }}>
                  {sf.suggestedQuestions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
                Raw Symptoms
              </div>
              <div style={{ padding: 'var(--space-3)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {sf.rawSymptoms}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submit Notes CTA */}
      {appointment.status === 'confirmed' && !appointment.visitNote && (
        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
          onClick={() => navigate(`/doctor/appointments/${id}/notes`)}
        >
          Submit Clinical Notes & Prescription →
        </button>
      )}

      {appointment.visitNote && (
        <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
          <h2 style={{ fontWeight: 700, marginBottom: 'var(--space-4)' }}>✅ Clinical Notes Submitted</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Notes were submitted on {new Date(appointment.visitNote.createdAt).toLocaleDateString()}.
          </p>
        </div>
      )}
    </div>
  );
}
