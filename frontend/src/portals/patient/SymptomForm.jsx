// ─── Symptom Form Page ───────────────────────────────────────────────────────

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { patientApi } from '../../api/patient.api';
import toast from '../../components/Toast';
import { HiOutlineArrowLeft } from 'react-icons/hi';

export default function SymptomForm() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    symptoms: '',
    durationDays: '',
    severity: 'moderate',
  });
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.symptoms.trim()) {
      return toast.error('Please describe your symptoms');
    }

    setLoading(true);
    try {
      const res = await patientApi.confirmAppointment(appointmentId, {
        symptoms: form.symptoms,
        durationDays: form.durationDays ? Number(form.durationDays) : null,
        severity: form.severity,
      });

      setAiResult(res.data.aiSummary);
      toast.success('Appointment confirmed! 🎉');

      setTimeout(() => {
        navigate('/patient/appointments');
      }, 2500);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to confirm appointment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: 700, margin: '0 auto' }}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => navigate(-1)}
        style={{ marginBottom: 'var(--space-4)' }}
      >
        <HiOutlineArrowLeft /> Back
      </button>

      <div className="glass-card-static" style={{ padding: 'var(--space-8)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-3)' }}>🩺</div>
          <h1 style={{ fontWeight: 700, fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-2)' }}>
            Symptom Information
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Please describe your symptoms so the doctor can prepare for your visit
          </p>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: 'var(--space-3)',
            padding: '6px 14px',
            background: 'var(--warning-bg)',
            color: 'var(--warning)',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
          }}>
            ⏱ Your slot is held for 5 minutes
          </div>
        </div>

        {aiResult ? (
          <div style={{ animation: 'fadeInUp 0.4s ease' }}>
            <div style={{
              textAlign: 'center',
              marginBottom: 'var(--space-6)',
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-3)' }}>✅</div>
              <h2 style={{ fontWeight: 700, fontSize: 'var(--font-size-xl)' }}>
                Appointment Confirmed!
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                Redirecting to your appointments...
              </p>
            </div>

            <div style={{ padding: 'var(--space-5)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)' }}>
              <h4 style={{ marginBottom: 'var(--space-3)', fontWeight: 600 }}>AI Pre-Visit Summary</h4>
              <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                <div>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Urgency</span>
                  <div><span className={`badge badge-urgency-${aiResult.urgencyLevel}`}>{aiResult.urgencyLevel}</span></div>
                </div>
                <div>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Chief Complaint</span>
                  <div style={{ fontWeight: 500 }}>{aiResult.chiefComplaint}</div>
                </div>
                {aiResult.suggestedQuestions?.length > 0 && (
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Suggested Questions for Doctor</span>
                    <ul style={{ marginTop: '4px', paddingLeft: '16px', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                      {aiResult.suggestedQuestions.map((q, i) => (
                        <li key={i} style={{ marginBottom: '4px' }}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="symptoms">
                Describe Your Symptoms *
              </label>
              <textarea
                id="symptoms"
                name="symptoms"
                className="form-textarea"
                placeholder="E.g., Fever for 3 days, mild headache, no cough..."
                value={form.symptoms}
                onChange={handleChange}
                rows={5}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="durationDays">Duration (days)</label>
                <input
                  id="durationDays"
                  name="durationDays"
                  type="number"
                  className="form-input"
                  placeholder="e.g. 3"
                  value={form.durationDays}
                  onChange={handleChange}
                  min="1"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="severity">Severity</label>
                <select
                  id="severity"
                  name="severity"
                  className="form-select"
                  value={form.severity}
                  onChange={handleChange}
                >
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: 'var(--space-4)' }}
              disabled={loading}
            >
              {loading ? '⏳ Submitting & generating AI summary...' : 'Confirm Appointment →'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
