// ─── Clinical Notes Form ─────────────────────────────────────────────────────

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doctorApi } from '../../api/doctor.api';
import toast from '../../components/Toast';
import { HiOutlineArrowLeft, HiOutlinePlus, HiOutlineTrash } from 'react-icons/hi';

export default function ClinicalNotesForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [prescription, setPrescription] = useState([
    { drug: '', dosage: '', frequency: '', duration_days: '' },
  ]);
  const [loading, setLoading] = useState(false);

  const addMedication = () => {
    setPrescription([...prescription, { drug: '', dosage: '', frequency: '', duration_days: '' }]);
  };

  const removeMedication = (index) => {
    setPrescription(prescription.filter((_, i) => i !== index));
  };

  const updateMedication = (index, field, value) => {
    const updated = [...prescription];
    updated[index] = { ...updated[index], [field]: value };
    setPrescription(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!clinicalNotes.trim()) {
      return toast.error('Clinical notes are required');
    }

    const validRx = prescription.filter((rx) => rx.drug.trim());
    if (validRx.length === 0) {
      return toast.error('At least one medication is required');
    }

    setLoading(true);
    try {
      const rxData = validRx.map((rx) => ({
        ...rx,
        duration_days: Number(rx.duration_days) || 0,
      }));

      await doctorApi.submitNotes(id, {
        clinicalNotes,
        prescription: rxData,
      });

      toast.success('Clinical notes submitted! AI post-visit summary is being generated.');
      navigate('/doctor');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit notes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: 800, margin: '0 auto' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 'var(--space-4)' }}>
        <HiOutlineArrowLeft /> Back
      </button>

      <div className="glass-card-static" style={{ padding: 'var(--space-8)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-3)' }}>📝</div>
          <h1 style={{ fontWeight: 700, fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-2)' }}>
            Clinical Notes & Prescription
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Submit your findings. An AI summary will be generated for the patient.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Clinical Notes */}
          <div className="form-group">
            <label className="form-label" htmlFor="clinical-notes">Clinical Notes *</label>
            <textarea
              id="clinical-notes"
              className="form-textarea"
              placeholder="Diagnosis, findings, examination results..."
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              rows={6}
              required
            />
          </div>

          {/* Prescription */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Prescription *</label>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addMedication}>
                <HiOutlinePlus size={16} /> Add Medication
              </button>
            </div>

            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              {prescription.map((rx, i) => (
                <div
                  key={i}
                  style={{
                    padding: 'var(--space-4)',
                    background: 'var(--bg-glass)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--glass-border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                    <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Medication #{i + 1}
                    </span>
                    {prescription.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        style={{ padding: '4px 8px' }}
                        onClick={() => removeMedication(i)}
                      >
                        <HiOutlineTrash size={14} />
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                    <input
                      className="form-input"
                      placeholder="Drug name"
                      value={rx.drug}
                      onChange={(e) => updateMedication(i, 'drug', e.target.value)}
                    />
                    <input
                      className="form-input"
                      placeholder="Dosage (e.g. 500mg)"
                      value={rx.dosage}
                      onChange={(e) => updateMedication(i, 'dosage', e.target.value)}
                    />
                    <input
                      className="form-input"
                      placeholder="Frequency (e.g. twice daily)"
                      value={rx.frequency}
                      onChange={(e) => updateMedication(i, 'frequency', e.target.value)}
                    />
                    <input
                      className="form-input"
                      type="number"
                      placeholder="Duration (days)"
                      value={rx.duration_days}
                      onChange={(e) => updateMedication(i, 'duration_days', e.target.value)}
                      min="1"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? '⏳ Submitting & generating AI summary...' : 'Submit Notes & Complete Visit →'}
          </button>
        </form>
      </div>
    </div>
  );
}
