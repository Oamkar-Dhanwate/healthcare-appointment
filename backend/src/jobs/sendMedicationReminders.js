// ─── Medication Reminders Job ────────────────────────────────────────────────
// Runs every 5 minutes. Sends due medication reminders to patients.

import prisma from "../config/db.js";
import { sendEmail, medicationReminderEmail } from "../services/email.service.js";

export async function sendMedicationReminders() {
  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 5 * 60 * 1000); // 5 min window

    const dueReminders = await prisma.medicationReminder.findMany({
      where: {
        sent: false,
        scheduledAt: { lte: windowEnd },
      },
      include: {
        patient: { select: { fullName: true, email: true } },
        visitNote: {
          select: { prescription: true },
        },
      },
      take: 50, // batch limit
    });

    let sentCount = 0;

    for (const reminder of dueReminders) {
      // Find instructions for this drug from the prescription
      const rxItems = Array.isArray(reminder.visitNote?.prescription)
        ? reminder.visitNote.prescription
        : [];
      const rxItem = rxItems.find(
        (r) => r.drug === reminder.drugName
      );
      const instructions = rxItem
        ? `${rxItem.dosage} — ${rxItem.frequency}`
        : reminder.drugName;

      const emailData = medicationReminderEmail({
        patientName: reminder.patient.fullName,
        drugName: reminder.drugName,
        instructions,
      });

      await sendEmail({ to: reminder.patient.email, ...emailData });

      await prisma.medicationReminder.update({
        where: { id: reminder.id },
        data: { sent: true },
      });

      sentCount++;
    }

    if (sentCount > 0) {
      console.log(
        `[MedReminders] Sent ${sentCount} medication reminder(s)`
      );
    }

    return sentCount;
  } catch (err) {
    console.error("[MedReminders] Error:", err.message);
    throw err;
  }
}

export default sendMedicationReminders;
