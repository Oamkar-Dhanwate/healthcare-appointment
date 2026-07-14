// ─── Slot Picker Page ────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { patientApi } from '../../api/patient.api';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from '../../components/Toast';
import { HiOutlineArrowLeft } from 'react-icons/hi';

export default function SlotPicker() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [date, setDate] = useState(searchParams.get('date') || new Date().toISOString().split('T')[0]);
  const [doctorInfo, setDoctorInfo] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    fetchSlots();
  }, [id, date]);

  async function fetchSlots() {
    setLoading(true);
    setSelectedSlot(null);
    try {
      const res = await patientApi.getDoctorSlots(id, date);
      setDoctorInfo(res.data.doctor);
      setSlots(res.data.slots || []);
    } catch (err) {
      toast.error('Failed to load slots');
    } finally {
      setLoading(false);
    }
  }

  async function handleHoldSlot() {
    if (!selectedSlot) return;
    setHolding(true);
    try {
      const res = await patientApi.holdSlot({
        doctorId: Number(id),
        slotStart: selectedSlot.start,
        slotEnd: selectedSlot.end,
      });
      toast.success('Slot reserved! Complete your symptom form to confirm.');
      navigate(`/patient/symptom-form/${res.data.appointment.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to hold slot');
    } finally {
      setHolding(false);
    }
  }

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

  const availableSlots = slots.filter((s) => s.available);
  const unavailableSlots = slots.filter((s) => !s.available);

  return (
    <div className="page-container">
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => navigate('/patient/doctors')}
        style={{ marginBottom: 'var(--space-4)' }}
      >
        <HiOutlineArrowLeft /> Back to Doctors
      </button>

      {doctorInfo && (
        <div className="glass-card-static" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
            <div>
              <h1 style={{ fontWeight: 700, fontSize: 'var(--font-size-2xl)', marginBottom: 'var(--space-1)' }}>
                Dr. {doctorInfo.name}
              </h1>
              <span className="badge badge-confirmed" style={{ textTransform: 'none' }}>
                {doctorInfo.specialisation}
              </span>
              <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>•</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                {doctorInfo.slotDurationMin} min per slot
              </span>
              {doctorInfo.consultationFee && (
                <>
                  <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>•</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                    ₹{Number(doctorInfo.consultationFee).toLocaleString()}
                  </span>
                </>
              )}
            </div>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
              <label className="form-label">Select Date</label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSpinner text="Loading available slots..." />
      ) : slots.length === 0 ? (
        <div className="empty-state glass-card-static">
          <div className="empty-icon">📅</div>
          <div className="empty-title">No Slots Available</div>
          <div className="empty-message">The doctor may be on leave or doesn&apos;t work on this day. Try another date.</div>
        </div>
      ) : (
        <>
          <div className="glass-card-static" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
            <h3 style={{ marginBottom: 'var(--space-5)', fontWeight: 600 }}>
              Available Slots
              <span style={{ color: 'var(--success)', marginLeft: '8px', fontSize: 'var(--font-size-sm)' }}>
                ({availableSlots.length} available)
              </span>
            </h3>

            {(() => {
              const { morning, afternoon, evening } = categorizeSlots(slots);
              const renderSlotButtons = (slotList) => (
                <div className="slot-grid-optimized">
                  {slotList.map((slot, index) => (
                    <button
                      key={index}
                      disabled={!slot.available}
                      onClick={() => setSelectedSlot(slot)}
                      className={`slot-btn-optimized ${selectedSlot?.start === slot.start ? 'selected' : ''}`}
                    >
                      {slot.startFormatted}
                    </button>
                  ))}
                </div>
              );

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {morning.length > 0 && (
                    <div className="slot-period-section">
                      <div className="slot-period-header">🌅 Morning</div>
                      {renderSlotButtons(morning)}
                    </div>
                  )}
                  {afternoon.length > 0 && (
                    <div className="slot-period-section">
                      <div className="slot-period-header">☀️ Afternoon</div>
                      {renderSlotButtons(afternoon)}
                    </div>
                  )}
                  {evening.length > 0 && (
                    <div className="slot-period-section">
                      <div className="slot-period-header">🌙 Evening</div>
                      {renderSlotButtons(evening)}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {selectedSlot && (
            <div
              className="glass-card-static"
              style={{
                padding: 'var(--space-6)',
                position: 'sticky',
                bottom: 'var(--space-6)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(30, 41, 59, 0.95)',
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>Selected: {selectedSlot.startFormatted} — {selectedSlot.endFormatted}</div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  Slot will be held for 5 minutes while you fill the symptom form
                </div>
              </div>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleHoldSlot}
                disabled={holding}
              >
                {holding ? 'Reserving...' : 'Reserve & Continue →'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
