// ─── Patient Dashboard ────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientApi } from '../../api/patient.api';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from '../../components/Toast';
import Modal from '../../components/Modal';
import { 
  HiOutlineCalendar, 
  HiOutlineClock, 
  HiOutlineUser, 
  HiOutlineCurrencyRupee, 
  HiOutlineSparkles, 
  HiOutlineLink 
} from 'react-icons/hi';

export default function PatientDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Booking states
  const [selectedSpecialisation, setSelectedSpecialisation] = useState('All');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Symptom Form Modal states
  const [isSymptomModalOpen, setIsSymptomModalOpen] = useState(false);
  const [heldAppointmentId, setHeldAppointmentId] = useState(null);
  const [symptoms, setSymptoms] = useState('');
  const [durationDays, setDurationDays] = useState(1);
  const [severity, setSeverity] = useState('mild');

  const specialisations = ['All', ...Array.from(new Set(doctors.map((d) => d.specialisation).filter(Boolean))).sort()];

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const [doctorSearchTerm, setDoctorSearchTerm] = useState('');

  // Filter doctors by specialisation pill and search query (name OR specialisation)
  const filteredDoctors = doctors.filter((doc) => {
    const matchesSpec =
      selectedSpecialisation === 'All' ||
      doc.specialisation?.toLowerCase() === selectedSpecialisation.toLowerCase();
    const term = doctorSearchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      doc.user?.fullName?.toLowerCase().includes(term) ||
      doc.specialisation?.toLowerCase().includes(term);
    return matchesSpec && matchesSearch;
  });

  useEffect(() => {
    if (doctors.length > 0) {
      const filtered = doctors.filter(
        (d) => d.specialisation.toLowerCase() === selectedSpecialisation.toLowerCase()
      );
      if (filtered.length > 0) {
        setSelectedDoctor(filtered[0]);
      } else {
        setSelectedDoctor(null);
      }
    }
  }, [selectedSpecialisation, doctors]);

  useEffect(() => {
    if (selectedDoctor) {
      fetchSlots(selectedDoctor.id, date);
    }
  }, [selectedDoctor, date]);

  async function fetchDashboardData() {
    setLoading(true);
    try {
      const [aptRes, docRes] = await Promise.all([
        patientApi.getMyAppointments(),
        patientApi.searchDoctors(),
      ]);
      setAppointments(aptRes.data.appointments || []);
      setDoctors(docRes.data.doctors || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSlots(doctorId, slotDate) {
    try {
      const res = await patientApi.getDoctorSlots(doctorId, slotDate);
      setSlots(res.data.slots || []);
    } catch (err) {
      console.error('Failed to load slots', err);
    }
  }

  // Handle slot hold
  const handleSlotSelect = async (slot) => {
    if (!slot.available) return;
    setSelectedSlot(slot);
    setBookingLoading(true);
    try {
      const res = await patientApi.holdSlot({
        doctorId: selectedDoctor.id,
        slotStart: slot.start,
        slotEnd: slot.end,
      });
      setHeldAppointmentId(res.data.appointment.id);
      setIsSymptomModalOpen(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Slot is no longer available');
      fetchSlots(selectedDoctor.id, date);
    } finally {
      setBookingLoading(false);
    }
  };

  // Confirm booking with symptoms
  const handleBookingConfirm = async (e) => {
    e.preventDefault();
    if (!symptoms.trim()) return toast.error('Please describe your symptoms');

    setBookingLoading(true);
    try {
      await patientApi.confirmAppointment(heldAppointmentId, {
        symptoms,
        durationDays: Number(durationDays),
        severity,
      });
      toast.success('Appointment booked successfully!');
      setIsSymptomModalOpen(false);
      setSymptoms('');
      setSelectedSlot(null);
      // Reload dashboard data
      fetchDashboardData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Booking confirmation failed');
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage text="Loading your dashboard..." />;

  // ─── Extract Upcoming visit data ───
  const upcomingVisit = appointments.find(
    (a) => a.status === 'confirmed'
  );

  // Compute days until next visit
  let daysUntilStr = '';
  if (upcomingVisit) {
    const diffTime = Math.abs(new Date(upcomingVisit.slotStart) - new Date());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    daysUntilStr = `Your next visit is in ${diffDays} day${diffDays > 1 ? 's' : ''}.`;
  } else {
    daysUntilStr = 'No upcoming visits scheduled.';
  }

  // Pre-visit brief calculations
  const preVisitBrief = upcomingVisit?.symptomForm?.chiefComplaint || 
    upcomingVisit?.symptomForm?.rawSymptoms || 
    "Bring: recent BP readings, current medication list. The doctor will ask about chest tightness triggers and exercise tolerance.";

  // Format date helper
  const formatFriendlyDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).replace(' at ', ' · ');
  };

  // ─── Extract Prescriptions & active medications ───
  // Let's find any completed visit prescription
  const completedVisit = appointments.find((a) => a.status === 'completed' && a.visitNote?.prescription);
  const activeMedication = completedVisit?.visitNote?.prescription?.[0] || {
    drug: 'Amlodipine 5mg',
    frequency: 'Once daily',
    duration_days: '3 days left'
  };

  const categorizeSlots = (slotsList) => {
    const morning = [];
    const afternoon = [];
    const evening = [];

    slotsList.forEach((slot) => {
      const hour = new Date(slot.start).getHours();
      if (hour < 12) {
        morning.push(slot);
      } else if (hour < 17) {
        afternoon.push(slot);
      } else {
        evening.push(slot);
      }
    });

    return { morning, afternoon, evening };
  };

  return (
    <div className="page-container">
      {/* Header section */}
      <div className="page-header" style={{ alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', color: '#8c9c96', textTransform: 'uppercase' }}>
            Patient Portal
          </span>
          <h1 className="serif-title" style={{ marginTop: '4px' }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.fullName?.split(' ')[0] || 'Guest'}.
          </h1>
          <p className="page-subtitle" style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {daysUntilStr}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Live date badge */}
          <div className="live-date-badge">
            <span className="pulse-dot" />
            {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/patient/doctors')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>+ New appointment</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          
          {/* 1. Upcoming Visit Card (Forest Green) */}
          {upcomingVisit ? (
            <div className="card-forest" style={{ padding: 'var(--space-6)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(250, 246, 240, 0.1)', paddingBottom: '12px', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#e2b157' }}>
                  Upcoming Visit
                </span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#e2b157' }}>
                  {upcomingVisit.status}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-family-serif)', fontSize: '1.75rem', fontWeight: 400, color: '#FAF6F0', marginBottom: '4px' }}>
                    Dr. {upcomingVisit.doctor?.user?.fullName} · {upcomingVisit.doctor?.specialisation}
                  </h2>
                  <p style={{ color: '#ebdcc5', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                    {formatFriendlyDate(upcomingVisit.slotStart)}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: 600, color: '#FAF6F0', fontSize: 'var(--font-size-sm)' }}>Room 402</p>
                  <p style={{ color: '#8c9c96', fontSize: '0.8rem' }}>Meridian Clinic - Downtown</p>
                </div>
              </div>

              {/* Pre-visit Brief banner inside dark green card */}
              <div style={{
                marginTop: 'var(--space-6)',
                padding: '16px',
                background: 'rgba(250, 246, 240, 0.05)',
                borderRadius: 'var(--radius-md)',
                borderLeft: '3px solid #e2b157',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#e2b157', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.06em' }}>
                  <HiOutlineSparkles /> Your Pre-Visit Brief
                </div>
                <p style={{ color: '#f7f3eb', fontSize: 'var(--font-size-sm)', lineHeight: 1.5 }}>
                  {upcomingVisit.symptomForm?.chiefComplaint || upcomingVisit.symptomForm?.rawSymptoms || "No symptoms described yet."}
                </p>
              </div>
            </div>
          ) : (
            <div className="glass-card-static" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>📅</div>
              <h3 style={{ fontFamily: 'var(--font-family-serif)', fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                No Upcoming Visits
              </h3>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                You have no scheduled checkups. Select a doctor below to book a consultation slot.
              </p>
            </div>
          )}

          {/* 2. Book a New Visit Card */}
          <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
              <h3 style={{ fontFamily: 'var(--font-family-serif)', fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-primary)' }}>
                Book a new visit
              </h3>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>

            {/* Specialisation filter pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
              {specialisations.map((spec) => (
                <button
                  key={spec}
                  onClick={() => setSelectedSpecialisation(spec)}
                  className={`spec-pill${selectedSpecialisation === spec ? ' active' : ''}`}
                >
                  {spec}
                </button>
              ))}
            </div>

            {/* Search Input for Doctors */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <input
                type="text"
                placeholder="🔍 Search doctor by name..."
                className="form-input"
                style={{ width: '100%', padding: '8px 12px', fontSize: 'var(--font-size-sm)' }}
                value={doctorSearchTerm}
                onChange={(e) => setDoctorSearchTerm(e.target.value)}
              />
            </div>

            {/* Doctors Grid Selection */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '8px', letterSpacing: '0.04em' }}>
                Select Doctor
              </label>
              
              {filteredDoctors.length === 0 ? (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px 0' }}>
                  No doctors found matching this search or specialisation.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                  {filteredDoctors.map((doc) => {
                    const isSelected = selectedDoctor?.id === doc.id;
                    const isOnLeave = doc.doctorLeaves?.some(l => l.leaveDate === date) || false;
                    
                    return (
                      <div
                        key={doc.id}
                        onClick={() => setSelectedDoctor(doc)}
                        style={{
                          padding: '10px',
                          background: isSelected ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                          border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--glass-border)',
                          borderRadius: 'var(--radius-lg)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'all 150ms ease',
                          boxShadow: isSelected ? 'var(--glass-shadow)' : 'none',
                        }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: isSelected ? 'var(--text-primary)' : 'var(--bg-tertiary)',
                          color: isSelected ? 'var(--bg-secondary)' : 'var(--text-primary)',
                          fontSize: '0.75rem', fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {doc.user?.fullName?.[0]?.toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            Dr. {doc.user?.fullName}
                          </h4>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                              Fee: ${doc.consultationFee || 120}
                            </span>
                            <span style={{
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              color: isOnLeave ? 'var(--danger)' : 'var(--success)'
                            }}>
                              {isOnLeave ? 'On leave' : 'Available'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Slots grid */}
            {selectedDoctor ? (
              <div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Available slots for <strong>Dr. {selectedDoctor.user?.fullName}</strong> ({selectedDoctor.specialisation}):
                </p>
                {!slots.some(s => s.available) ? (
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No slots available on this date. Choose another date below:
                  </p>
                ) : (
                  (() => {
                    const { morning, afternoon, evening } = categorizeSlots(slots);
                    const renderSlotButtons = (slotList) => {
                      const availableSlots = slotList.filter(s => s.available);
                      if (availableSlots.length === 0) return null;
                      
                      return (
                        <div className="slot-grid-optimized">
                          {availableSlots.map((slot, index) => {
                            const timeStr = new Date(slot.start).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            });
                            return (
                              <button
                                key={index}
                                disabled={bookingLoading}
                                onClick={() => handleSlotSelect(slot)}
                                className={`slot-btn-optimized ${selectedSlot === slot ? 'selected' : ''}`}
                              >
                                {timeStr}
                              </button>
                            );
                          })}
                        </div>
                      );
                    };

                    const hasMorning = morning.some(s => s.available);
                    const hasAfternoon = afternoon.some(s => s.available);
                    const hasEvening = evening.some(s => s.available);

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                        {hasMorning && (
                          <div className="slot-period-section">
                            <div className="slot-period-header">🌅 Morning</div>
                            {renderSlotButtons(morning)}
                          </div>
                        )}
                        {hasAfternoon && (
                          <div className="slot-period-section">
                            <div className="slot-period-header">☀️ Afternoon</div>
                            {renderSlotButtons(afternoon)}
                          </div>
                        )}
                        {hasEvening && (
                          <div className="slot-period-section">
                            <div className="slot-period-header">🌙 Evening</div>
                            {renderSlotButtons(evening)}
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
                {/* Datepicker inside the card */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                  <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>Change date:</label>
                  <input
                    type="date"
                    className={`form-input${date === new Date().toISOString().split('T')[0] ? ' today-highlight' : ''}`}
                    style={{ width: 160, padding: '6px 12px' }}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  {date === new Date().toISOString().split('T')[0] && (
                    <span style={{ fontSize: 'var(--font-size-xs)', color: '#10b981', fontWeight: 600 }}>Today</span>
                  )}
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                No active doctors found for {selectedSpecialisation}.
              </p>
            )}
          </div>
        </div>

        {/* Right Column (Stack of widgets) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Card 1: Countdown Widget */}
          <div className="glass-card-static" style={{ padding: 'var(--space-5)', display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
            <div style={{
              width: 42, height: 42, borderRadius: 'var(--radius-md)', background: '#FAF6F0',
              display: 'flex', alignItems: 'center', justify: 'center', color: '#072b20', fontSize: '1.25rem', flexShrink: 0
            }}>
              <HiOutlineClock style={{ margin: 'auto' }} />
            </div>
            <div>
              <h4 style={{ fontFamily: 'var(--font-family-serif)', fontSize: '1.5rem', fontWeight: 500, lineHeight: 1.1 }}>
                24h
              </h4>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                Until your reminder email arrives.
              </p>
            </div>
          </div>

          {/* Card 2: Active Prescription Widget (Mustard Yellow) */}
          {completedVisit ? (
            <div className="card-gold" style={{ padding: 'var(--space-5)', display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
              <div style={{
                width: 42, height: 42, borderRadius: 'var(--radius-md)', background: 'rgba(7, 43, 32, 0.08)',
                display: 'flex', alignItems: 'center', justify: 'center', color: '#072b20', fontSize: '1.25rem', flexShrink: 0
              }}>
                <HiOutlineLink style={{ margin: 'auto' }} />
              </div>
              <div>
                <h4 style={{ fontFamily: 'var(--font-family-serif)', fontSize: '1.15rem', fontWeight: 600, color: '#072b20', marginBottom: '2px' }}>
                  {completedVisit.visitNote.prescription[0]?.drug || 'Prescription Details'}
                </h4>
                <p style={{ fontSize: 'var(--font-size-sm)', color: '#442e05', fontWeight: 500 }}>
                  {completedVisit.visitNote.prescription[0]?.dosage} · {completedVisit.visitNote.prescription[0]?.frequency}
                </p>
              </div>
            </div>
          ) : (
            <div className="glass-card-static" style={{ padding: 'var(--space-5)', display: 'flex', gap: 'var(--space-4)', alignItems: 'center', opacity: 0.85 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 'var(--radius-md)', background: '#FAF6F0',
                display: 'flex', alignItems: 'center', justify: 'center', color: 'var(--text-muted)', fontSize: '1.25rem', flexShrink: 0
              }}>
                <HiOutlineLink style={{ margin: 'auto' }} />
              </div>
              <div>
                <h4 style={{ fontFamily: 'var(--font-family-serif)', fontSize: '1.05rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>
                  No Active Prescriptions
                </h4>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', margin: 0 }}>
                  Future medication details will show up here.
                </p>
              </div>
            </div>
          )}

          {/* Card 3: Calendar Sync Status Widget */}
          <div className="glass-card-static" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{
                width: 42, height: 42, borderRadius: 'var(--radius-md)', background: '#FAF6F0',
                display: 'flex', alignItems: 'center', justify: 'center', color: '#072b20', fontSize: '1.25rem', flexShrink: 0
              }}>
                <HiOutlineCalendar style={{ margin: 'auto' }} />
              </div>
              <div>
                <h4 style={{ fontFamily: 'var(--font-family-serif)', fontSize: '1.15rem', fontWeight: 500 }}>
                  Calendar synced
                </h4>
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                  Google Calendar · {user?.email}
                </p>
              </div>
            </div>
            {upcomingVisit && (
              <div style={{
                background: 'var(--bg-tertiary)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--text-secondary)',
                fontWeight: 500,
              }}>
                Next event: {upcomingVisit.doctor?.user?.fullName} follow-up · {new Date(upcomingVisit.slotStart).toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Doctors you've seen (Bottom Card) */}
      <div className="glass-card-static" style={{ padding: 'var(--space-6)' }}>
        <h3 style={{ fontFamily: 'var(--font-family-serif)', fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
          Doctors you&apos;ve seen
        </h3>
        
        {doctors.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>No doctors seen yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {doctors.slice(0, 3).map((doc) => (
              <div
                key={doc.id}
                className="doctor-row"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 'var(--radius-full)', background: 'var(--bg-tertiary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#072b20', fontSize: '1rem'
                  }}>
                    {doc.user?.fullName?.[0]}
                  </div>
                  <div>
                    <h5 style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', color: 'var(--text-primary)' }}>
                      Dr. {doc.user?.fullName}
                    </h5>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                      {doc.specialisation}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>Fee</p>
                    <p style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700 }}>₹{Number(doc.consultationFee || 120).toLocaleString()}</p>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    style={{ padding: '6px 18px' }}
                    onClick={() => {
                      setSelectedSpecialisation(doc.specialisation);
                      setSelectedDoctor(doc);
                      window.scrollTo({ top: 300, behavior: 'smooth' });
                    }}
                  >
                    Book
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Symptom Booking Form Modal */}
      <Modal
        isOpen={isSymptomModalOpen}
        onClose={() => setIsSymptomModalOpen(false)}
        title="Fill out your pre-visit symptom brief"
      >
        <form onSubmit={handleBookingConfirm}>
          <div className="form-group">
            <label className="form-label" htmlFor="dashboard-symptoms">Symptom Description *</label>
            <textarea
              id="dashboard-symptoms"
              className="form-textarea"
              placeholder="Please describe your symptoms, current health issues, or existing conditions..."
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              required
              rows={4}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="dashboard-duration">Duration (days)</label>
              <input
                id="dashboard-duration"
                className="form-input"
                type="number"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                min="1"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="dashboard-severity">Self-Reported Severity</label>
              <select
                id="dashboard-severity"
                className="form-select"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 'var(--space-4)' }}
            disabled={bookingLoading}
          >
            {bookingLoading ? 'Confirming hold...' : 'Submit symptoms and Confirm visit'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
