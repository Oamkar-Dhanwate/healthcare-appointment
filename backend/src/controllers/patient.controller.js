// ─── Patient Controller ──────────────────────────────────────────────────────
// Handles doctor search, slot browsing, appointment booking (hold → confirm),
// cancellation, and post-visit summary retrieval.

import prisma from "../config/db.js";
import { getAvailableSlots, isSlotAvailable } from "../services/slot.service.js";
import { generatePreVisitSummary } from "../services/mistral.service.js";
import { sendEmail, bookingConfirmationEmail, doctorBookingConfirmationEmail, appointmentCancellationEmail } from "../services/email.service.js";
import { createCalendarEvent, deleteCalendarEvent } from "../services/calendar.service.js";

const HOLD_TTL = Number(process.env.SLOT_HOLD_TTL_SECONDS) || 300;

/**
 * GET /api/v1/doctors?specialisation=&date=
 * Search doctors by specialisation and availability.
 */
export async function searchDoctors(req, res, next) {
  try {
    const { specialisation, date } = req.query;

    const where = {};
    if (specialisation) {
      where.specialisation = {
        contains: specialisation,
      };
    }

    const doctors = await prisma.doctor.findMany({
      where,
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
      },
      orderBy: { specialisation: "asc" },
    });

    // If date is provided, compute available slot counts
    let result = doctors;
    if (date) {
      result = await Promise.all(
        doctors.map(async (doc) => {
          const slots = await getAvailableSlots(doc.id, date);
          const availableCount = slots.filter((s) => s.available).length;
          return { ...doc, availableSlots: availableCount };
        })
      );
    }

    res.json({ doctors: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/doctors/:id/slots?date=
 * Get open slots for a doctor on a specific date.
 */
export async function getDoctorSlots(req, res, next) {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: "date query parameter is required" });
    }

    const slots = await getAvailableSlots(Number(id), date);

    // Also return doctor info
    const doctor = await prisma.doctor.findUnique({
      where: { id: Number(id) },
      include: { user: { select: { fullName: true } } },
    });

    res.json({
      doctor: {
        id: doctor.id,
        name: doctor.user.fullName,
        specialisation: doctor.specialisation,
        slotDurationMin: doctor.slotDurationMin,
        consultationFee: doctor.consultationFee,
      },
      date,
      slots,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/appointments/hold
 * Place a temporary hold on a slot while the patient fills the symptom form.
 */
export async function holdSlot(req, res, next) {
  try {
    const { doctorId, slotStart, slotEnd } = req.body;
    const patientId = req.user.id;

    if (!doctorId || !slotStart || !slotEnd) {
      return res.status(400).json({
        error: "Required fields: doctorId, slotStart, slotEnd",
      });
    }

    // Check slot availability
    const available = await isSlotAvailable(Number(doctorId), slotStart);
    if (!available) {
      return res.status(409).json({
        error: "Slot is no longer available",
        message: "This time slot has been taken. Please select another slot.",
      });
    }

    // Create held appointment
    const holdExpiresAt = new Date(Date.now() + HOLD_TTL * 1000);

    const appointment = await prisma.appointment.create({
      data: {
        doctorId: Number(doctorId),
        patientId,
        slotStart: new Date(slotStart),
        slotEnd: new Date(slotEnd),
        status: "held",
        holdExpiresAt,
      },
    });

    res.status(201).json({
      message: "Slot held successfully",
      appointment: {
        id: appointment.id,
        slotStart: appointment.slotStart,
        slotEnd: appointment.slotEnd,
        holdExpiresAt: appointment.holdExpiresAt,
        holdTtlSeconds: HOLD_TTL,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/appointments/:id/confirm
 * Submit symptoms and confirm the appointment.
 * Triggers pre-visit AI summary generation.
 */
export async function confirmAppointment(req, res, next) {
  try {
    const { id } = req.params;
    const { symptoms, durationDays, severity } = req.body;
    const patientId = req.user.id;

    if (!symptoms) {
      return res.status(400).json({ error: "symptoms field is required" });
    }

    // Fetch the held appointment
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: Number(id),
        patientId,
        status: "held",
      },
      include: {
        doctor: {
          include: { user: { select: { fullName: true, email: true, googleRefreshToken: true } } },
        },
        patient: { select: { fullName: true, email: true, googleRefreshToken: true } },
      },
    });

    if (!appointment) {
      return res.status(404).json({
        error: "Appointment not found or hold has expired",
      });
    }

    // Check hold hasn't expired
    if (appointment.holdExpiresAt && new Date() > appointment.holdExpiresAt) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { status: "cancelled" },
      });
      return res.status(410).json({
        error: "Hold expired",
        message: "Your reservation has expired. Please select a new slot.",
      });
    }

    // Generate AI pre-visit summary (non-blocking on failure)
    let aiResult = null;
    let aiStatus = "pending";
    try {
      aiResult = await generatePreVisitSummary({
        symptoms,
        durationDays,
        severity,
      });
      if (aiResult) aiStatus = "ok";
    } catch {
      aiStatus = "failed";
    }

    // Create symptom form + confirm appointment (atomic)
    const validSeverity = ["mild", "moderate", "severe"].includes(String(severity).toLowerCase())
      ? String(severity).toLowerCase()
      : null;

    const [updatedAppointment, symptomForm] = await prisma.$transaction([
      prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          status: "confirmed",
          holdExpiresAt: null,
        },
      }),
      prisma.symptomForm.create({
        data: {
          appointmentId: appointment.id,
          rawSymptoms: symptoms,
          durationDays: durationDays ? parseInt(durationDays, 10) : null,
          severity: validSeverity,
          urgencyLevel: aiResult?.urgencyLevel || null,
          chiefComplaint: aiResult?.chiefComplaint || null,
          suggestedQuestions: aiResult?.suggestedQuestions || null,
          aiStatus,
        },
      }),
    ]);

    // Format email data for patient and doctor
    const patientEmailData = bookingConfirmationEmail({
      patientName: appointment.patient.fullName,
      doctorName: appointment.doctor.user.fullName,
      date: appointment.slotStart.toLocaleDateString(),
      time: appointment.slotStart.toLocaleTimeString(),
    });

    const doctorEmailData = doctorBookingConfirmationEmail({
      patientName: appointment.patient.fullName,
      doctorName: appointment.doctor.user.fullName,
      date: appointment.slotStart.toLocaleDateString(),
      time: appointment.slotStart.toLocaleTimeString(),
      chiefComplaint: aiResult?.chiefComplaint || null,
      urgencyLevel: aiResult?.urgencyLevel || null,
    });

    // Queue booking confirmation notification for patient
    await prisma.notification.create({
      data: {
        userId: patientId,
        type: "booking_confirmation",
        channel: "email",
        status: "queued",
        payload: {
          subject: patientEmailData.subject,
          html: patientEmailData.html,
          appointmentId: appointment.id,
          patientEmail: appointment.patient.email,
          patientName: appointment.patient.fullName,
          doctorName: appointment.doctor.user.fullName,
          slotStart: appointment.slotStart.toISOString(),
          slotEnd: appointment.slotEnd.toISOString(),
        },
      },
    });

    // Queue booking confirmation notification for doctor
    await prisma.notification.create({
      data: {
        userId: appointment.doctor.userId,
        type: "booking_confirmation",
        channel: "email",
        status: "queued",
        payload: {
          subject: doctorEmailData.subject,
          html: doctorEmailData.html,
          appointmentId: appointment.id,
          patientEmail: appointment.patient.email,
          patientName: appointment.patient.fullName,
          doctorName: appointment.doctor.user.fullName,
          slotStart: appointment.slotStart.toISOString(),
          slotEnd: appointment.slotEnd.toISOString(),
        },
      },
    });

    // Send confirmation email to patient (async, non-blocking)
    sendEmail({
      to: appointment.patient.email,
      ...patientEmailData,
    }).catch((err) =>
      console.error("[Email] Patient confirmation send failed:", err.message)
    );

    // Send confirmation email to doctor (async, non-blocking)
    sendEmail({
      to: appointment.doctor.user.email,
      ...doctorEmailData,
    }).catch((err) =>
      console.error("[Email] Doctor confirmation send failed:", err.message)
    );

    // Create Google Calendar events (async, non-blocking)
    const calendarPromises = [];
    const calendarSummary = `Appointment: ${appointment.patient.fullName} ↔ Dr. ${appointment.doctor.user.fullName}`;

    if (appointment.patient.googleRefreshToken) {
      calendarPromises.push(
        createCalendarEvent({
          refreshToken: appointment.patient.googleRefreshToken,
          summary: calendarSummary,
          description: `Symptoms: ${symptoms}`,
          startDateTime: appointment.slotStart.toISOString(),
          endDateTime: appointment.slotEnd.toISOString(),
          attendeeEmail: appointment.doctor.user.email,
        }).then((eventId) => {
          if (eventId) {
            prisma.appointment.update({
              where: { id: appointment.id },
              data: { googleEventIdPatient: eventId },
            });
          }
        })
      );
    }

    if (appointment.doctor.user.googleRefreshToken) {
      calendarPromises.push(
        createCalendarEvent({
          refreshToken: appointment.doctor.user.googleRefreshToken,
          summary: calendarSummary,
          description: `Patient symptoms: ${symptoms}\nUrgency: ${aiResult?.urgencyLevel || "pending"}`,
          startDateTime: appointment.slotStart.toISOString(),
          endDateTime: appointment.slotEnd.toISOString(),
          attendeeEmail: appointment.patient.email,
        }).then((eventId) => {
          if (eventId) {
            prisma.appointment.update({
              where: { id: appointment.id },
              data: { googleEventIdDoctor: eventId },
            });
          }
        })
      );
    }

    // Fire and forget calendar creation
    Promise.allSettled(calendarPromises).catch(() => {});

    res.json({
      appointmentId: updatedAppointment.id,
      status: updatedAppointment.status,
      aiSummary: aiResult
        ? {
            urgencyLevel: aiResult.urgencyLevel,
            chiefComplaint: aiResult.chiefComplaint,
            suggestedQuestions: aiResult.suggestedQuestions,
          }
        : null,
      aiStatus,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/appointments/:id/cancel
 * Cancel an appointment.
 */
export async function cancelAppointment(req, res, next) {
  try {
    const { id } = req.params;
    const patientId = req.user.id;

    const appointment = await prisma.appointment.findFirst({
      where: {
        id: Number(id),
        patientId,
        status: { in: ["held", "confirmed"] },
      },
      include: {
        doctor: {
          include: { user: { select: { fullName: true, email: true, googleRefreshToken: true } } },
        },
        patient: { select: { fullName: true, email: true, googleRefreshToken: true } },
      },
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "cancelled" },
    });

    // Delete Calendar Events
    const calendarPromises = [];
    if (appointment.googleEventIdPatient && appointment.patient.googleRefreshToken) {
      calendarPromises.push(
        deleteCalendarEvent({
          refreshToken: appointment.patient.googleRefreshToken,
          eventId: appointment.googleEventIdPatient,
        })
      );
    }
    if (appointment.googleEventIdDoctor && appointment.doctor.user.googleRefreshToken) {
      calendarPromises.push(
        deleteCalendarEvent({
          refreshToken: appointment.doctor.user.googleRefreshToken,
          eventId: appointment.googleEventIdDoctor,
        })
      );
    }
    Promise.allSettled(calendarPromises).catch(() => {});

    // Send Cancellation Emails
    if (appointment.status === "confirmed") {
      const emailData = appointmentCancellationEmail({
        patientName: appointment.patient.fullName,
        doctorName: appointment.doctor.user.fullName,
        date: appointment.slotStart.toLocaleDateString(),
        time: appointment.slotStart.toLocaleTimeString(),
      });
      sendEmail({ to: appointment.patient.email, ...emailData }).catch(() => {});
      sendEmail({ to: appointment.doctor.user.email, ...emailData }).catch(() => {});
    }

    res.json({ message: "Appointment cancelled", appointmentId: appointment.id });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/appointments/me
 * List the patient's own appointments.
 */
export async function getMyAppointments(req, res, next) {
  try {
    const patientId = req.user.id;

    const appointments = await prisma.appointment.findMany({
      where: { patientId },
      include: {
        doctor: {
          select: {
            id: true,
            specialisation: true,
            user: { select: { fullName: true } },
          },
        },
        symptomForm: {
          select: {
            urgencyLevel: true,
            chiefComplaint: true,
            aiStatus: true,
          },
        },
        visitNote: {
          select: {
            patientSummary: true,
            aiStatus: true,
          },
        },
      },
      orderBy: { slotStart: "desc" },
    });

    res.json({ appointments });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/appointments/:id/summary
 * Get post-visit summary for a completed appointment.
 */
export async function getPostVisitSummary(req, res, next) {
  try {
    const { id } = req.params;
    const patientId = req.user.id;

    const appointment = await prisma.appointment.findFirst({
      where: { id: Number(id), patientId },
      include: {
        doctor: {
          include: { user: { select: { fullName: true } } },
        },
        visitNote: true,
      },
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    if (!appointment.visitNote) {
      return res.status(404).json({
        error: "No visit notes available yet",
        message: "The doctor has not yet submitted notes for this visit.",
      });
    }

    res.json({
      appointment: {
        id: appointment.id,
        doctorName: appointment.doctor.user.fullName,
        date: appointment.slotStart,
      },
      visitNote: {
        patientSummary: appointment.visitNote.patientSummary,
        prescription: appointment.visitNote.prescription,
        aiStatus: appointment.visitNote.aiStatus,
        createdAt: appointment.visitNote.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export default {
  searchDoctors,
  getDoctorSlots,
  holdSlot,
  confirmAppointment,
  cancelAppointment,
  getMyAppointments,
  getPostVisitSummary,
};
