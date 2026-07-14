// ─── Post-Visit Summary Page ─────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { patientApi } from '../../api/patient.api';
import LoadingSpinner from '../../components/LoadingSpinner';
import { HiOutlineArrowLeft } from 'react-icons/hi';

const Section = ({ icon, title, color, children }) => (
  <div style={{
    padding: 'var(--space-5)',
    background: 'var(--bg-glass)',
    borderRadius: 'var(--radius-lg)',
    border: `1px solid var(--glass-border)`,
    borderLeft: `4px solid ${color}`,
  }}>
    <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-3)', color, display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--font-size-base)' }}>
      {icon} {title}
    </h3>
    {children}
  </div>
);

const textStyle = { color: 'var(--text-secondary)', lineHeight: 1.75 };
const listStyle = { paddingLeft: '20px', color: 'var(--text-secondary)', lineHeight: 1.85, margin: 0 };

export default function PostVisitSummary() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const res = await patientApi.getPostVisitSummary(id);
        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [id]);

  if (loading) return <LoadingSpinner fullPage text="Loading your medical report..." />;

  const raw = data?.visitNote?.patientSummary;
  const report = raw
    ? (typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw)
    : null;

  const prescription = Array.isArray(data?.visitNote?.prescription) ? data.visitNote.prescription : [];

  return (
    <div className="page-container" style={{ maxWidth: 780, margin: '0 auto' }}>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => navigate('/patient/appointments')}
        style={{ marginBottom: 'var(--space-4)' }}
      >
        <HiOutlineArrowLeft /> Back to Appointments
      </button>

      {/* Header */}
      <div className="glass-card-static" style={{ padding: 'var(--space-8)', marginBottom: 'var(--space-5)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-3)' }}>📋</div>
          <h1 style={{ fontWeight: 800, fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-2)' }}>
            Patient Medical Report
          </h1>
          {data?.appointment && (
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              Dr. {data.appointment.doctorName} · {new Date(data.appointment.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>

        {report ? (
          <>
            {/* 1. Patient Summary */}
            {report.patientSummary && (
              <Section icon="👤" title="1. Patient Summary" color="var(--accent-primary)">
                <div style={{ display: 'grid', gap: '6px' }}>
                  <div><strong>Main Complaint:</strong> <span style={textStyle}>{report.patientSummary.mainComplaint}</span></div>
                  <div><strong>Duration:</strong> <span style={textStyle}>{report.patientSummary.duration}</span></div>
                  <div><strong>Severity:</strong> <span style={{ ...textStyle, textTransform: 'capitalize', fontWeight: 600, color: report.patientSummary.severity === 'severe' ? '#ef4444' : report.patientSummary.severity === 'moderate' ? '#f59e0b' : '#10b981' }}>{report.patientSummary.severity}</span></div>
                </div>
              </Section>
            )}

            {/* 2. Symptoms Reported */}
            {report.symptomsReported && (
              <Section icon="🩺" title="2. Symptoms Reported" color="#8b5cf6">
                <p style={textStyle}>{report.symptomsReported}</p>
              </Section>
            )}

            {/* 3. Clinical Assessment */}
            {report.clinicalAssessment && (
              <Section icon="🔬" title="3. Clinical Assessment" color="#06b6d4">
                <p style={textStyle}>{report.clinicalAssessment}</p>
              </Section>
            )}

            {/* 4. Recommended Examinations */}
            {report.recommendedExaminations?.length > 0 && (
              <Section icon="📊" title="4. Recommended Examinations" color="#f59e0b">
                <ul style={listStyle}>
                  {report.recommendedExaminations.map((exam, i) => <li key={i}>{exam}</li>)}
                </ul>
              </Section>
            )}

            {/* 5. Provisional Diagnosis */}
            {report.provisionalDiagnosis && (
              <Section icon="🏥" title="5. Provisional Diagnosis" color="var(--accent-primary)">
                <p style={{ ...textStyle, fontWeight: 600, fontSize: 'var(--font-size-base)' }}>{report.provisionalDiagnosis}</p>
              </Section>
            )}

            {/* 6. Treatment Plan */}
            {report.treatmentPlan && (
              <Section icon="💚" title="6. Treatment Plan" color="#10b981">
                <div style={{ display: 'grid', gap: '8px' }}>
                  {[
                    ['🏃 Lifestyle', report.treatmentPlan.lifestyle],
                    ['🏠 Home Care', report.treatmentPlan.homeCare],
                    ['💧 Hydration', report.treatmentPlan.hydration],
                    ['😴 Rest', report.treatmentPlan.rest],
                    ['🥗 Diet', report.treatmentPlan.diet],
                    ['📅 Follow-Up', report.treatmentPlan.followUp],
                  ].filter(([, v]) => v).map(([label, value], i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: 600, minWidth: 110, fontSize: 'var(--font-size-sm)' }}>{label}:</span>
                      <span style={textStyle}>{value}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* 7. Medications */}
            {(report.medicationSuggestions?.length > 0 || prescription.length > 0) && (
              <Section icon="💊" title="7. Medication Details" color="#10b981">
                {report.medicationSuggestions?.length > 0 ? (
                  <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    {report.medicationSuggestions.map((med, i) => (
                      <div key={i} style={{
                        padding: 'var(--space-3) var(--space-4)',
                        background: 'rgba(16, 185, 129, 0.06)',
                        borderRadius: 'var(--radius-md)',
                        borderLeft: '3px solid #10b981',
                      }}>
                        <div style={{ fontWeight: 700, marginBottom: '4px' }}>{med.drug} {med.strength && `· ${med.strength}`}</div>
                        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', display: 'grid', gap: '2px' }}>
                          {med.dose && <span>📌 Dose: {med.dose}</span>}
                          {med.frequency && <span>🕐 Frequency: {med.frequency}</span>}
                          {med.duration && <span>📆 Duration: {med.duration}</span>}
                          {med.precautions && <span style={{ color: '#f59e0b' }}>⚠️ {med.precautions}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : prescription.length > 0 ? (
                  <table className="data-table">
                    <thead><tr><th>Drug</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead>
                    <tbody>
                      {prescription.map((rx, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{rx.drug}</td>
                          <td>{rx.dosage}</td>
                          <td>{rx.frequency}</td>
                          <td>{rx.duration_days} days</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </Section>
            )}

            {/* 8. Red Flag Symptoms */}
            {report.redFlagSymptoms?.length > 0 && (
              <Section icon="🚨" title="8. Red Flag Symptoms — Seek Immediate Care" color="#ef4444">
                <ul style={{ ...listStyle, color: '#ef4444' }}>
                  {report.redFlagSymptoms.map((flag, i) => <li key={i}>{flag}</li>)}
                </ul>
              </Section>
            )}

            {/* 9. Follow-Up */}
            {(report.followUp || report.followUpSteps?.length > 0) && (
              <Section icon="📅" title="9. Follow-Up" color="#f59e0b">
                {report.followUp && <p style={{ ...textStyle, marginBottom: report.followUpSteps?.length > 0 ? '12px' : 0 }}>{report.followUp}</p>}
                {report.followUpSteps?.length > 0 && (
                  <ol style={listStyle}>
                    {report.followUpSteps.map((step, i) => <li key={i}>{step}</li>)}
                  </ol>
                )}
              </Section>
            )}
          </>
        ) : (
          // Fallback when AI report unavailable
          <>
            {data?.visitNote?.clinicalNotes && (
              <Section icon="📝" title="Diagnosis & Notes" color="var(--accent-primary)">
                <p style={textStyle}>{data.visitNote.clinicalNotes}</p>
              </Section>
            )}
            {prescription.length > 0 && (
              <Section icon="💊" title="Prescription" color="#10b981">
                <table className="data-table">
                  <thead><tr><th>Drug</th><th>Dosage</th><th>Frequency</th><th>Duration</th></tr></thead>
                  <tbody>
                    {prescription.map((rx, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{rx.drug}</td>
                        <td>{rx.dosage}</td>
                        <td>{rx.frequency}</td>
                        <td>{rx.duration_days} days</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            )}
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', textAlign: 'center' }}>
              💡 AI medical report is generating. Full structured report will appear after processing.
            </div>
          </>
        )}

        {/* Disclaimer */}
        <div style={{
          padding: 'var(--space-4)',
          background: 'rgba(239,68,68,0.05)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid rgba(239,68,68,0.2)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--text-muted)',
          lineHeight: 1.7,
          textAlign: 'center',
        }}>
          ⚕️ <em>This report is AI-generated for informational purposes only. It is not a substitute for examination, diagnosis, or treatment by a qualified healthcare professional.</em>
        </div>
      </div>
    </div>
  );
}
