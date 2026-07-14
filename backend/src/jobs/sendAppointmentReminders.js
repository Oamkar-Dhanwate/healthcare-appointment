// ─── Appointment Reminders Job ───────────────────────────────────────────────
// Runs every 5 minutes. Sends email reminders 24h and 1h before appointments.

import prisma from "../config/db.js";
import { sendEmail, reminderEmail } from "../services/email.service.js";

export async function sendAppointmentReminders() {
  try {
    const now = new Date();

    // Find appointments starting in ~24h (23.5h to 24.5h from now)
    const reminder24hStart = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
    const reminder24hEnd = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);

    // Find appointments starting in ~1h (0.5h to 1.5h from now)
    const reminder1hStart = new Date(now.getTime() + 0.5 * 60 * 60 * 1000);
    const reminder1hEnd = new Date(now.getTime() + 1.5 * 60 * 60 * 1000);

    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        status: "confirmed",
        OR: [
          { slotStart: { gte: reminder24hStart, lte: reminder24hEnd } },
          { slotStart: { gte: reminder1hStart, lte: reminder1hEnd } },
        ],
      },
      include: {
        patient: { select: { id: true, fullName: true, email: true } },
        doctor: {
          include: { user: { select: { fullName: true } } },
        },
      },
    });

    let sentCount = 0;

    for (const apt of upcomingAppointments) {
      // Check if we already sent a reminder for this time window
      const existingReminder = await prisma.notification.findFirst({
        where: {
          userId: apt.patient.id,
          type: "reminder",
          createdAt: { gte: new Date(now.getTime() - 10 * 60 * 1000) }, // last 10 min
        },
      });

      if (existingReminder) continue;

      const hoursUntil = Math.round(
        (apt.slotStart.getTime() - now.getTime()) / (60 * 60 * 1000)
      );
      const hoursLabel = hoursUntil <= 1 ? "1 hour" : "24 hours";

      // Queue notification
      await prisma.notification.create({
        data: {
          userId: apt.patient.id,
          type: "reminder",
          channel: "email",
          status: "queued",
          payload: {
            appointmentId: apt.id,
            hoursUntil: hoursLabel,
          },
        },
      });

      // Send email
      const emailData = reminderEmail({
        patientName: apt.patient.fullName,
        doctorName: apt.doctor.user.fullName,
        date: apt.slotStart.toLocaleDateString(),
        time: apt.slotStart.toLocaleTimeString(),
        hoursUntil: hoursLabel,
      });

      await sendEmail({ to: apt.patient.email, ...emailData });
      sentCount++;
    }

    if (sentCount > 0) {
      console.log(`[Reminders] Sent ${sentCount} appointment reminder(s)`);
    }

    return sentCount;
  } catch (err) {
    console.error("[Reminders] Error:", err.message);
    throw err;
  }
}

export default sendAppointmentReminders;
