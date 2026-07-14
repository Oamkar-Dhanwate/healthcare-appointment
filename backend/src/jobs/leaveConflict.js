// ─── Leave Conflict Job ──────────────────────────────────────────────────────
// Triggered when admin marks a leave day. Cancels all confirmed appointments
// for that doctor on the leave date and notifies affected patients.

import prisma from "../config/db.js";
import { sendEmail, leaveNoticeEmail } from "../services/email.service.js";
import { deleteCalendarEvent } from "../services/calendar.service.js";

export async function handleLeaveConflict({ doctorId, leaveDate }) {
  try {
    const dayStart = new Date(leaveDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(leaveDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Find all confirmed appointments for this doctor on the leave date
    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        status: "confirmed",
        slotStart: { gte: dayStart, lte: dayEnd },
      },
      include: {
        patient: {
          select: {
            id: true,
            fullName: true,
            email: true,
            googleRefreshToken: true,
          },
        },
        doctor: {
          include: {
            user: {
              select: { fullName: true, googleRefreshToken: true },
            },
          },
        },
      },
    });

    if (appointments.length === 0) {
      console.log("[LeaveConflict] No conflicting appointments found");
      return 0;
    }

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

    for (const apt of appointments) {
      // Cancel the appointment
      await prisma.appointment.update({
        where: { id: apt.id },
        data: { status: "leave_cancelled" },
      });

      // Delete Google Calendar events (if they exist)
      if (apt.googleEventIdPatient && apt.patient.googleRefreshToken) {
        await deleteCalendarEvent({
          refreshToken: apt.patient.googleRefreshToken,
          eventId: apt.googleEventIdPatient,
        });
      }
      if (apt.googleEventIdDoctor && apt.doctor.user.googleRefreshToken) {
        await deleteCalendarEvent({
          refreshToken: apt.doctor.user.googleRefreshToken,
          eventId: apt.googleEventIdDoctor,
        });
      }

      // Send leave notice email
      const rebookingLink = `${clientUrl}/patient/doctors/${apt.doctorId}/slots`;
      const emailData = leaveNoticeEmail({
        patientName: apt.patient.fullName,
        doctorName: apt.doctor.user.fullName,
        date: apt.slotStart.toLocaleDateString(),
        rebookingLink,
      });

      await sendEmail({ to: apt.patient.email, ...emailData });

      // Log notification
      await prisma.notification.create({
        data: {
          userId: apt.patient.id,
          type: "leave_notice",
          channel: "email",
          status: "sent",
          payload: {
            appointmentId: apt.id,
            leaveDate,
          },
        },
      });
    }

    console.log(
      `[LeaveConflict] Cancelled ${appointments.length} appointment(s) and notified patients`
    );
    return appointments.length;
  } catch (err) {
    console.error("[LeaveConflict] Error:", err.message);
    throw err;
  }
}

export default handleLeaveConflict;
