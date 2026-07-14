// ─── Doctor Controller ───────────────────────────────────────────────────────
// Handles doctor's appointment view (with AI pre-visit summaries) and
// clinical notes + prescription submission (with AI post-visit summary).

import prisma from "../config/db.js";
import { generatePostVisitSummary } from "../services/mistral.service.js";
import {
  sendEmail,
  postVisitSummaryEmail,
  medicationReminderEmail,
} from "../services/email.service.js";

/**
 * GET /api/v1/doctor/appointments?date=
 * List doctor's appointments with AI pre-visit summary.
 * Can filter/sort by urgency.
 */
export async function getAppointments(req, res, next) {
  try {
    const { date, sortByUrgency } = req.query;

    // Find the doctor profile for the logged-in user
    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id },
    });

    if (!doctor) {
      return res
        .status(404)
        .json({ error: "Doctor profile not found for this user" });
    }

    const where = {
      doctorId: doctor.id,
      status: { in: ["confirmed", "completed"] },
    };

    if (date) {
      // Parse date as UTC to avoid timezone shifting (DB stores UTC, date picker sends YYYY-MM-DD)
      const dayStart = new Date(`${date}T00:00:00.000Z`);
      const dayEnd = new Date(`${date}T23:59:59.999Z`);
      where.slotStart = { gte: dayStart, lte: dayEnd };
    }

    let appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        symptomForm: true,
        visitNote: {
          select: { id: true, aiStatus: true, createdAt: true },
        },
      },
      orderBy: { slotStart: "asc" },
    });

    // Sort by urgency if requested (High → Medium → Low)
    if (sortByUrgency === "true") {
      const urgencyOrder = { High: 0, Medium: 1, Low: 2, null: 3 };
      appointments.sort((a, b) => {
        const aLevel = a.symptomForm?.urgencyLevel ?? null;
        const bLevel = b.symptomForm?.urgencyLevel ?? null;
        return (urgencyOrder[aLevel] ?? 3) - (urgencyOrder[bLevel] ?? 3);
      });
    }

    res.json({ appointments });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/doctor/appointments/:id
 * Get single appointment detail with full symptom form and visit note.
 */
export async function getAppointmentDetail(req, res, next) {
  try {
    const { id } = req.params;

    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id },
    });

    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }

    const appointment = await prisma.appointment.findFirst({
      where: { id: Number(id), doctorId: doctor.id },
      include: {
        patient: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        symptomForm: true,
        visitNote: true,
      },
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }

    res.json({ appointment });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/doctor/appointments/:id/notes
 * Submit clinical notes + prescription. Triggers AI post-visit summary.
 */
export async function submitNotes(req, res, next) {
  try {
    const { id } = req.params;
    const { clinicalNotes, prescription } = req.body;

    if (!clinicalNotes || !prescription) {
      return res.status(400).json({
        error: "Required fields: clinicalNotes, prescription",
      });
    }

    // Verify this is the doctor's appointment
    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { fullName: true } } },
    });

    if (!doctor) {
      return res.status(404).json({ error: "Doctor profile not found" });
    }

    const appointment = await prisma.appointment.findFirst({
      where: { id: Number(id), doctorId: doctor.id, status: "confirmed" },
      include: {
        patient: { select: { id: true, fullName: true, email: true } },
        symptomForm: {
          select: { rawSymptoms: true, severity: true, durationDays: true },
        },
      },
    });

    if (!appointment) {
      return res.status(404).json({
        error: "Confirmed appointment not found",
      });
    }

    // Generate AI post-visit summary (non-blocking on failure)
    let aiResult = null;
    let aiStatus = "pending";
    try {
      aiResult = await generatePostVisitSummary({
        clinicalNotes,
        prescription,
        patientName: appointment.patient.fullName,
        symptoms: appointment.symptomForm?.rawSymptoms || null,
        severity: appointment.symptomForm?.severity || null,
        durationDays: appointment.symptomForm?.durationDays || null,
      });
      if (aiResult) aiStatus = "ok";
    } catch {
      aiStatus = "failed";
    }

    // Save visit note + mark appointment complete
    const [visitNote] = await prisma.$transaction([
      prisma.visitNote.create({
        data: {
          appointmentId: appointment.id,
          clinicalNotes,
          prescription,
          patientSummary: aiResult
            ? JSON.stringify(aiResult)
            : null,
          aiStatus,
        },
      }),
      prisma.appointment.update({
        where: { id: appointment.id },
        data: { status: "completed" },
      }),
    ]);

    // Parse prescription and create medication reminders
    const prescriptionItems = Array.isArray(prescription)
      ? prescription
      : [];

    const reminderData = [];
    for (const item of prescriptionItems) {
      const { drug, frequency, duration_days } = item;
      if (!drug || !frequency || !duration_days) continue;

      // Parse frequency (e.g., "twice daily" → 2 times per day)
      let timesPerDay = 1;
      const freqLower = (frequency || "").toLowerCase();
      if (freqLower.includes("twice") || freqLower.includes("2")) timesPerDay = 2;
      if (freqLower.includes("three") || freqLower.includes("3") || freqLower.includes("thrice"))
        timesPerDay = 3;
      if (freqLower.includes("four") || freqLower.includes("4")) timesPerDay = 4;

      // Generate reminder entries
      const hoursApart = Math.floor(24 / timesPerDay);
      const startDate = new Date();

      for (let day = 0; day < duration_days; day++) {
        for (let dose = 0; dose < timesPerDay; dose++) {
          const scheduledAt = new Date(startDate);
          scheduledAt.setDate(scheduledAt.getDate() + day);
          scheduledAt.setHours(8 + dose * hoursApart, 0, 0, 0); // Start at 8 AM

          reminderData.push({
            visitNoteId: visitNote.id,
            patientId: appointment.patient.id,
            drugName: drug,
            scheduledAt,
          });
        }
      }
    }

    if (reminderData.length > 0) {
      await prisma.medicationReminder.createMany({ data: reminderData });
    }

    // Fallback if AI generation is skipped or failed
    const summaryText = aiResult?.summary || clinicalNotes;
    const medicationSchedule = aiResult?.medicationSchedule || prescriptionItems.map(item => ({
      drug: item.drug,
      instructions: `${item.dosage || ''} · ${item.frequency || ''} (${item.duration_days || ''} days)`.replace(/ · $/g, '').trim()
    }));
    const steps = aiResult?.followUpSteps || [];

    // Send post-visit email (async)
    const emailData = postVisitSummaryEmail({
      patientName: appointment.patient.fullName,
      doctorName: doctor.user.fullName,
      summary: summaryText,
      medicationSchedule,
      followUpSteps: steps,
    });

    // Queue post-visit summary email notification
    await prisma.notification.create({
      data: {
        userId: appointment.patient.id,
        type: "booking_confirmation",
        channel: "email",
        status: "queued",
        payload: {
          subject: emailData.subject,
          html: emailData.html,
          type: "post_visit_summary",
          appointmentId: appointment.id,
          patientEmail: appointment.patient.email,
          patientName: appointment.patient.fullName,
          doctorName: doctor.user.fullName,
          summary: summaryText,
          medicationSchedule,
          followUpSteps: steps,
        },
      },
    });

    sendEmail({ to: appointment.patient.email, ...emailData }).catch(
      (err) =>
        console.error("[Email] Post-visit summary send failed:", err.message)
    );

    res.json({
      message: "Clinical notes submitted successfully",
      visitNote: {
        id: visitNote.id,
        aiStatus,
        patientSummary: aiResult,
        medicationRemindersCreated: reminderData.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/doctor/availability?date=
 * Fetch available slots for this doctor on a date.
 */
export async function getAvailability(req, res, next) {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Date parameter is required" });

    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id }
    });
    if (!doctor) return res.status(404).json({ error: "Doctor profile not found" });

    const slots = await getAvailableSlots(doctor.id, date);
    res.json({ slots });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/doctor/slots/custom
 * Add a custom self-entered slot.
 */
export async function addCustomSlot(req, res, next) {
  try {
    const { date, start, end } = req.body;
    if (!date || !start || !end) {
      return res.status(400).json({ error: "Required fields: date, start, end" });
    }

    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id }
    });
    if (!doctor) return res.status(404).json({ error: "Doctor profile not found" });

    const workingHours = typeof doctor.workingHours === "string"
      ? JSON.parse(doctor.workingHours)
      : doctor.workingHours || {};

    const customSlots = workingHours.customSlots || [];
    
    // Add custom slot if not duplicate
    const exists = customSlots.some(s => s.date === date && s.start === start);
    if (!exists) {
      customSlots.push({ date, start, end, isAiGenerated: false });
    }

    workingHours.customSlots = customSlots;

    await prisma.doctor.update({
      where: { id: doctor.id },
      data: { workingHours }
    });

    res.json({ message: "Custom slot added successfully", customSlots });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/doctor/slots/remove
 * Remove a specific slot (weekday default or custom slot).
 */
export async function removeSlot(req, res, next) {
  try {
    const { date, start } = req.body;
    if (!date || !start) {
      return res.status(400).json({ error: "Required fields: date, start" });
    }

    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id }
    });
    if (!doctor) return res.status(404).json({ error: "Doctor profile not found" });

    const workingHours = typeof doctor.workingHours === "string"
      ? JSON.parse(doctor.workingHours)
      : doctor.workingHours || {};

    // Remove from customSlots if it was added manually there
    if (workingHours.customSlots) {
      workingHours.customSlots = workingHours.customSlots.filter(
        s => !(s.date === date && s.start === start)
      );
    }

    // Add to removedSlots list so we track weekday slot removals
    const removedSlots = workingHours.removedSlots || [];
    const exists = removedSlots.some(s => s.date === date && s.start === start);
    if (!exists) {
      removedSlots.push({ date, start });
    }
    workingHours.removedSlots = removedSlots;

    await prisma.doctor.update({
      where: { id: doctor.id },
      data: { workingHours }
    });

    res.json({ message: "Slot removed successfully" });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/doctor/slots/generate-ai
 * AI-powered prediction and slot creation based on booking patterns.
 */
export async function triggerAiPatternGeneration(req, res, next) {
  try {
    const { date } = req.body;
    // Default to tomorrow if not specified (a day before target date)
    const targetDate = date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user.id }
    });
    if (!doctor) return res.status(404).json({ error: "Doctor profile not found" });

    const generated = await generateSlotsFromPatterns(doctor.id, targetDate);

    res.json({
      message: `AI generated ${generated.length} slots for ${targetDate} based on patient booking patterns.`,
      date: targetDate,
      slots: generated
    });
  } catch (err) {
    next(err);
  }
}

import { getAvailableSlots, generateSlotsFromPatterns } from "../services/slot.service.js";

export default {
  getAppointments,
  getAppointmentDetail,
  submitNotes,
  getAvailability,
  addCustomSlot,
  removeSlot,
  triggerAiPatternGeneration,
};
