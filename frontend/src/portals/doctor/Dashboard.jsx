// ─── Doctor Dashboard ────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { doctorApi } from '../../api/doctor.api';
import { adminApi } from '../../api/admin.api';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from '../../components/Toast';
import Modal from '../../components/Modal';
import { 
  HiOutlineClock, 
  HiOutlineSparkles, 
  HiOutlinePlus, 
  HiOutlineTrash, 
  HiOutlineCalendar 
} from 'react-icons/hi';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [selectedApt, setSelectedApt] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [sortByUrgency, setSortByUrgency] = useState(true);
  const [loading, setLoading] = useState(true);

  // Clinical Notes & Prescription form state
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [prescription, setPrescription] = useState([
    { drug: '', dosage: '', frequency: '', duration_days: '' }
  ]);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Leave modal state
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split('T')[0]);
  const [leaveReason, setLeaveReason] = useState('Personal');

  // Availability & Custom Slots states
  const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [availDate, setAvailDate] = useState(tomorrowStr);
  const [availSlots, setAvailSlots] = useState([]);
  const [newSlotStart, setNewSlotStart] = useState('09:00');
  const [newSlotEnd, setNewSlotEnd] = useState('09:15');
  const [availLoading, setAvailLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetchAppointments();
  }, [date, sortByUrgency]);

  useEffect(() => {
    fetchAvailability();
  }, [availDate]);

  const fetchAvailability = async () => {
    setAvailLoading(true);
    try {
      const res = await doctorApi.getAvailability(availDate);
      setAvailSlots(res.data.slots || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load slots');
    } finally {
      setAvailLoading(false);
    }
  };

  const handleAddCustomSlot = async (e) => {
    e.preventDefault();
    if (!newSlotStart || !newSlotEnd) return toast.error('Start and end times are required');
    try {
      await doctorApi.addCustomSlot({
        date: availDate,
        start: newSlotStart,
        end: newSlotEnd
      });
      toast.success('Custom slot added successfully!');
      fetchAvailability();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add custom slot');
    }
  };

  const handleRemoveSlot = async (startFormatted) => {
    try {
      await doctorApi.removeSlot({
        date: availDate,
        start: startFormatted
      });
      toast.success('Slot removed from availability.');
      fetchAvailability();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove slot');
    }
  };

  const handleTriggerAiSlots = async () => {
    setAiLoading(true);
    try {
      const res = await doctorApi.triggerAiPatternGeneration({ date: availDate });
      toast.success(res.data.message || 'AI generated slots successfully!');
      fetchAvailability();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate slots');
    } finally {
      setAiLoading(false);
    }
  };

  // If list updates, reset or update selected appointment
  useEffect(() => {
    if (appointments.length > 0) {
      // Keep selection if it still exists in the list
      const stillExists = appointments.find((a) => a.id === selectedApt?.id);
      if (!stillExists) {
        setSelectedApt(appointments[0]);
      } else {
        setSelectedApt(stillExists);
      }
    } else {
      setSelectedApt(null);
    }
  }, [appointments]);

  // Load clinical notes data when selected appointment changes
  useEffect(() => {
    if (selectedApt) {
      setClinicalNotes(selectedApt.visitNote?.clinicalNotes || '');
      if (selectedApt.visitNote?.prescription) {
        setPrescription(selectedApt.visitNote.prescription);
      } else {
        setPrescription([{ drug: '', dosage: '', frequency: '', duration_days: '' }]);
      }
    }
  }, [selectedApt]);

  async function fetchAppointments() {
    setLoading(true);
    try {
      const res = await doctorApi.getAppointments({ date, sortByUrgency });
      setAppointments(res.data.appointments || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }

  const handleAddMedication = () => {
    setPrescription([...prescription, { drug: '', dosage: '', frequency: '', duration_days: '' }]);
  };

  const handleRemoveMedication = (index) => {
    setPrescription(prescription.filter((_, i) => i !== index));
  };

  const handleUpdateMedication = (index, field, value) => {
    const updated = [...prescription];
    updated[index] = { ...updated[index], [field]: value };
    setPrescription(updated);
  };

  const handleNotesSubmit = async (e) => {
    e.preventDefault();
    if (!selectedApt) return;
    if (!clinicalNotes.trim()) return toast.error('Clinical notes are required');

    const validRx = prescription.filter((rx) => rx.drug.trim());
    if (validRx.length === 0) {
      return toast.error('At least one medication is required');
    }

    setSubmitLoading(true);
    try {
      const rxData = validRx.map((rx) => ({
        ...rx,
        duration_days: Number(rx.duration_days) || 0,
      }));

      await doctorApi.submitNotes(selectedApt.id, {
        clinicalNotes,
        prescription: rxData,
      });

      toast.success('Clinical notes submitted! Patient summary is generating.');
      fetchAppointments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit notes');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Submit leave
  const handleMarkLeave = async (e) => {
    e.preventDefault();
    if (!user?.doctorId) return toast.error('Doctor profile ID not found');

    try {
      await adminApi.markLeave(user.doctorId, {
        leaveDate,
        reason: leaveReason,
      });
      toast.success('Leave day marked successfully!');
      setIsLeaveModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to mark leave day');
    }
  };

  const formatTime = (d) => new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  // Counts for Today at a Glance
  const bookedCount = appointments.filter((a) => a.status === 'confirmed').length;
  const seenCount = appointments.filter((a) => a.status === 'completed').length;
  const highCount = appointments.filter((a) => a.symptomForm?.urgencyLevel === 'High').length;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', color: '#8c9c96', textTransform: 'uppercase' }}>
            Doctor Portal
          </span>
          <h1 className="serif-title" style={{ marginTop: '4px' }}>
            Dr. {user?.fullName || 'Anika Rao'}
          </h1>
          <p className="page-subtitle" style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)' }}>
            {appointments.length} appointment{appointments.length !== 1 ? 's' : ''} today · {highCount} high urgency
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Toggle sort button styled as pill */}
          <button
            onClick={() => setSortByUrgency(!sortByUrgency)}
            className="btn btn-secondary"
            style={{
              background: sortByUrgency ? '#ece6db' : 'transparent',
              borderColor: 'var(--text-primary)',
            }}
          >
            Sort by urgency
          </button>
          
          <button 
            className="btn btn-primary" 
            onClick={() => setIsLeaveModalOpen(true)}
            style={{ background: '#063327' }}
          >
            Mark leave
          </button>

          <input
            type="date"
            className="form-input"
            style={{ width: 150, padding: '6px 12px' }}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 'var(--space-6)' }}>
        
        {/* Left Column (Appointments List) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loading ? (
            <LoadingSpinner text="Loading appointments..." />
          ) : appointments.length === 0 ? (
            <div className="empty-state glass-card-static">
              <div className="empty-icon">📅</div>
              <div className="empty-title">No appointments</div>
              <div className="empty-message">No appointments booked for this date.</div>
            </div>
          ) : (
            appointments.map((apt) => {
              const isHigh = apt.symptomForm?.urgencyLevel === 'High';
              const isMedium = apt.symptomForm?.urgencyLevel === 'Medium';
              const urgencyText = apt.symptomForm?.urgencyLevel || 'LOW';
              
              const isSelected = selectedApt?.id === apt.id;

              return (
                <div
                  key={apt.id}
                  className="glass-card-static"
                  style={{
                    padding: 'var(--space-5)',
                    borderRadius: 'var(--radius-xl)',
                    border: isSelected 
                      ? '2px solid #063327' 
                      : isHigh 
                      ? '1px solid rgba(239, 68, 68, 0.4)' 
                      : '1px solid var(--glass-border)',
                    boxShadow: isHigh ? '0 4px 12px rgba(239, 68, 68, 0.04)' : 'var(--glass-shadow)',
                    transition: 'all 200ms ease',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                        <HiOutlineClock />
                        {formatTime(apt.slotStart)}
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: isHigh ? 'rgba(239, 68, 68, 0.1)' : isMedium ? 'var(--warning-bg)' : 'var(--success-bg)',
                          color: isHigh ? 'var(--danger)' : isMedium ? '#b28635' : 'var(--success)',
                          fontSize: '0.65rem',
                          padding: '2px 8px',
                        }}
                      >
                        {isHigh ? '🔥 ' : ''}{urgencyText}
                      </span>
                    </div>

                    <button
                      className="btn btn-primary btn-sm"
                      style={{ padding: '4px 12px', background: isSelected ? '#0a3c2c' : '#063327' }}
                      onClick={() => setSelectedApt(apt)}
                    >
                      {isSelected ? 'Selected' : 'Open'}
                    </button>
                  </div>

                  <h3 style={{ fontFamily: 'var(--font-family-serif)', fontSize: '1.45rem', fontWeight: 400, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {apt.patient?.fullName}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '16px' }}>
                    {apt.symptomForm?.rawSymptoms || 'No symptoms described.'} · {apt.symptomForm?.durationDays || 1} day(s)
                  </p>

                  {/* Suggested questions box */}
                  {apt.symptomForm?.suggestedQuestions && (
                    <div style={{
                      padding: '12px 16px',
                      background: '#f7f3eb',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid #ebdcc5',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', fontWeight: 700, color: '#b28635', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
                        <HiOutlineSparkles /> Suggested Questions
                      </div>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {Array.isArray(apt.symptomForm.suggestedQuestions) ? (
                          apt.symptomForm.suggestedQuestions.map((q, idx) => (
                            <li key={idx} style={{ fontSize: '0.825rem', color: '#5c6f68', marginBottom: '4px', lineHeight: 1.4 }}>
                              • {q}
                            </li>
                          ))
                        ) : (
                          <li style={{ fontSize: '0.825rem', color: '#5c6f68' }}>
                            {apt.symptomForm.suggestedQuestions}
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right Column (Clinical Notes Form & Stats) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          
          {/* AI Pre-Visit Summary Card (Right Column, above Clinical Notes) */}
          {selectedApt && selectedApt.symptomForm && (
            <div className="glass-card-static" style={{ padding: 'var(--space-5)', borderLeft: `4px solid ${selectedApt.symptomForm.urgencyLevel === 'High' ? 'var(--danger)' : selectedApt.symptomForm.urgencyLevel === 'Medium' ? '#b28635' : 'var(--success)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontFamily: 'var(--font-family-serif)', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  🤖 Pre-Visit AI Triage
                </h4>
                <span
                  className="badge"
                  style={{
                    background: selectedApt.symptomForm.urgencyLevel === 'High' ? 'rgba(239, 68, 68, 0.1)' : selectedApt.symptomForm.urgencyLevel === 'Medium' ? 'var(--warning-bg)' : 'var(--success-bg)',
                    color: selectedApt.symptomForm.urgencyLevel === 'High' ? 'var(--danger)' : selectedApt.symptomForm.urgencyLevel === 'Medium' ? '#b28635' : 'var(--success)',
                    fontSize: '0.65rem',
                    padding: '2px 8px',
                  }}
                >
                  {selectedApt.symptomForm.urgencyLevel === 'High' ? '🔥 ' : ''}{selectedApt.symptomForm.urgencyLevel || 'LOW'} URGENCY
                </span>
              </div>

              <div style={{ display: 'grid', gap: '12px', fontSize: 'var(--font-size-sm)' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Chief Complaint</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedApt.symptomForm.chiefComplaint || 'Not summarized'}</span>
                </div>

                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Patient Symptoms</span>
                  <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.825rem', lineHeight: 1.5, background: 'rgba(0,0,0,0.02)', padding: '8px', borderRadius: '4px' }}>
                    {selectedApt.symptomForm.rawSymptoms}
                  </p>
                </div>

                {selectedApt.symptomForm.suggestedQuestions && (
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#b28635', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Suggested Questions to Ask</span>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {Array.isArray(selectedApt.symptomForm.suggestedQuestions) ? (
                        selectedApt.symptomForm.suggestedQuestions.map((q, idx) => (
                          <li key={idx} style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', paddingLeft: '8px', borderLeft: '2px solid var(--accent-secondary)', marginBottom: '4px' }}>
                            {q}
                          </li>
                        ))
                      ) : (
                        <li style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', paddingLeft: '8px', borderLeft: '2px solid var(--accent-secondary)' }}>
                          {selectedApt.symptomForm.suggestedQuestions}
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 1. Dark Green Clinical Notes Form Card */}
          <div className="card-forest" style={{ padding: 'var(--space-6)' }}>
            <h3 style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#e2b157',
              borderBottom: '1px solid rgba(250, 246, 240, 0.1)',
              paddingBottom: '12px',
              marginBottom: '16px'
            }}>
              Clinical Notes {selectedApt ? `· ${selectedApt.patient?.fullName.toUpperCase()}` : ''}
            </h3>

            {selectedApt ? (
              <form onSubmit={handleNotesSubmit}>
                <div className="form-group">
                  <textarea
                    className="form-textarea"
                    placeholder="Diagnosis, findings, examination results..."
                    style={{
                      background: 'rgba(250, 246, 240, 0.04)',
                      borderColor: 'rgba(250, 246, 240, 0.15)',
                      color: '#FAF6F0',
                      minHeight: 120,
                    }}
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    required
                  />
                </div>

                <div style={{ margin: '20px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#FAF6F0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Prescription
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 10px', color: '#FAF6F0', borderColor: 'rgba(250, 246, 240, 0.2)' }}
                      onClick={handleAddMedication}
                    >
                      <HiOutlinePlus size={14} /> Add
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {prescription.map((rx, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '12px',
                          background: 'rgba(250, 246, 240, 0.02)',
                          border: '1px solid rgba(250, 246, 240, 0.1)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr auto', gap: '8px', alignItems: 'center' }}>
                          <input
                            className="form-input"
                            placeholder="Drug name"
                            style={{ background: 'rgba(0,0,0,0.1)', color: '#fff', fontSize: '0.8rem', padding: '6px' }}
                            value={rx.drug}
                            onChange={(e) => handleUpdateMedication(i, 'drug', e.target.value)}
                          />
                          <input
                            className="form-input"
                            placeholder="Dosage"
                            style={{ background: 'rgba(0,0,0,0.1)', color: '#fff', fontSize: '0.8rem', padding: '6px' }}
                            value={rx.dosage}
                            onChange={(e) => handleUpdateMedication(i, 'dosage', e.target.value)}
                          />
                          <input
                            className="form-input"
                            placeholder="Freq"
                            style={{ background: 'rgba(0,0,0,0.1)', color: '#fff', fontSize: '0.8rem', padding: '6px' }}
                            value={rx.frequency}
                            onChange={(e) => handleUpdateMedication(i, 'frequency', e.target.value)}
                          />
                          <input
                            className="form-input"
                            placeholder="Days"
                            type="number"
                            style={{ background: 'rgba(0,0,0,0.1)', color: '#fff', fontSize: '0.8rem', padding: '6px' }}
                            value={rx.duration_days}
                            onChange={(e) => handleUpdateMedication(i, 'duration_days', e.target.value)}
                            min="1"
                          />
                          {prescription.length > 1 && (
                            <button
                              type="button"
                              style={{ background: 'transparent', border: 'none', color: '#ff7878', cursor: 'pointer', display: 'flex' }}
                              onClick={() => handleRemoveMedication(i)}
                            >
                              <HiOutlineTrash size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-lg"
                  style={{
                    width: '100%',
                    background: '#e2b157',
                    color: '#072b20',
                    border: 'none',
                    fontWeight: 700,
                  }}
                  disabled={submitLoading || selectedApt.status === 'completed'}
                >
                  {submitLoading 
                    ? 'Submitting notes...' 
                    : selectedApt.status === 'completed'
                    ? 'Visit Completed'
                    : 'Submit & generate summary'}
                </button>
              </form>
            ) : (
              <p style={{ color: '#8c9c96', fontSize: 'var(--font-size-sm)', textAlign: 'center', padding: '24px 0' }}>
                Select an appointment to write clinical notes.
              </p>
            )}
          </div>

          {/* 2. Today at a glance (Metrics Grid card) */}
          <div className="glass-card-static" style={{ padding: 'var(--space-5)' }}>
            <h4 style={{ fontFamily: 'var(--font-family-serif)', fontSize: '1.25rem', fontWeight: 400, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Today at a glance
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div style={{ background: '#f7f3eb', border: '1px solid #ebdcc5', padding: '12px 6px', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 500, fontFamily: 'var(--font-family-serif)', color: '#072b20', display: 'block' }}>
                  {bookedCount}
                </span>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#8c9c96', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Booked
                </span>
              </div>
              
              <div style={{ background: '#f7f3eb', border: '1px solid #ebdcc5', padding: '12px 6px', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 500, fontFamily: 'var(--font-family-serif)', color: '#072b20', display: 'block' }}>
                  {seenCount}
                </span>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#8c9c96', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Seen
                </span>
              </div>
              
              <div style={{ 
                background: highCount > 0 ? 'rgba(239, 68, 68, 0.08)' : '#f7f3eb', 
                border: highCount > 0 ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid #ebdcc5', 
                padding: '12px 6px', 
                borderRadius: 'var(--radius-md)', 
                textAlign: 'center' 
              }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 500, fontFamily: 'var(--font-family-serif)', color: highCount > 0 ? 'var(--danger)' : '#072b20', display: 'block' }}>
                  {highCount}
                </span>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: highCount > 0 ? 'var(--danger)' : '#8c9c96', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  High
                </span>
              </div>
            </div>
          </div>

          {/* 3. Availability & Custom Slots Panel */}
          <div className="glass-card-static" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ fontFamily: 'var(--font-family-serif)', fontSize: '1.25rem', fontWeight: 400, color: 'var(--text-primary)', margin: 0 }}>
                Availability & Custom Slots
              </h4>
              <input
                type="date"
                className="form-input"
                style={{ width: 140, padding: '4px 8px', fontSize: '0.8rem' }}
                value={availDate}
                onChange={(e) => setAvailDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* AI generation block */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              background: 'rgba(7, 43, 32, 0.03)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--glass-border)',
              marginBottom: '16px'
            }}>
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#b28635', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <HiOutlineSparkles /> Pattern Learning
                </span>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Generates preferred slots based on booking patterns
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem', padding: '6px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
                onClick={handleTriggerAiSlots}
                disabled={aiLoading}
              >
                {aiLoading ? 'Predicting...' : 'Run AI Pattern'}
              </button>
            </div>

            {/* Quick add custom slot form */}
            <form onSubmit={handleAddCustomSlot} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--glass-border)' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Start</label>
                <input
                  type="time"
                  className="form-input"
                  style={{ padding: '6px', fontSize: '0.8rem' }}
                  value={newSlotStart}
                  onChange={(e) => setNewSlotStart(e.target.value)}
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>End</label>
                <input
                  type="time"
                  className="form-input"
                  style={{ padding: '6px', fontSize: '0.8rem' }}
                  value={newSlotEnd}
                  onChange={(e) => setNewSlotEnd(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ alignSelf: 'end', padding: '8px 12px', height: 34, background: '#063327' }}
              >
                Add Slot
              </button>
            </form>

            {/* Current slots list */}
            <div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '8px', letterSpacing: '0.04em' }}>
                Available slots ({availSlots.length})
              </span>

              {availLoading ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>Loading slots...</div>
              ) : availSlots.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0', fontStyle: 'italic' }}>
                  No slots opened for this date.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: 200, overflowY: 'auto', paddingRight: '4px' }}>
                  {availSlots.map((slot, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 10px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {slot.startFormatted} – {slot.endFormatted}
                        </span>
                        {slot.isCustom && (
                          <span className="badge" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.6rem', padding: '1px 6px' }}>
                            {slot.isAiGenerated ? '🤖 AI Pattern' : 'Custom'}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', padding: 2 }}
                        onClick={() => handleRemoveSlot(slot.startFormatted)}
                        title="Remove slot"
                      >
                        <HiOutlineTrash size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Leave Day Modal */}
      <Modal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        title="Mark Leave Day"
      >
        <form onSubmit={handleMarkLeave}>
          <div className="form-group">
            <label className="form-label" htmlFor="leave-date-input">Leave Date</label>
            <input
              id="leave-date-input"
              type="date"
              className="form-input"
              value={leaveDate}
              onChange={(e) => setLeaveDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="leave-reason-input">Reason</label>
            <input
              id="leave-reason-input"
              type="text"
              className="form-input"
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
            Submit Leave Request
          </button>
        </form>
      </Modal>
    </div>
  );
}
