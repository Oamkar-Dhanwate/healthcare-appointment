// ─── Email Service ───────────────────────────────────────────────────────────
// Sends transactional emails via SMTP (Nodemailer) or SendGrid.
// All emails are queued through the notifications table for retry tracking.

import nodemailer from "nodemailer";

let transporter = null;

/**
 * Initialize the email transporter (lazy, singleton).
 */
function getTransporter() {
  if (transporter) return transporter;

  const provider = process.env.EMAIL_PROVIDER || "smtp";

  if (provider === "sendgrid") {
    transporter = nodemailer.createTransport({
      host: "smtp.sendgrid.net",
      port: 587,
      auth: {
        user: "apikey",
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  } else {
    // Default SMTP
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT) || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      console.warn(
        "[Email] SMTP credentials not configured. Emails will be logged to console."
      );
      return null;
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  return transporter;
}

/**
 * Send an email. Falls back to console logging if transporter is unavailable.
 */
export async function sendEmail({ to, subject, html, text }) {
  const from = process.env.EMAIL_FROM || "Healthcare <no-reply@healthcare.app>";
  const transport = getTransporter();

  if (!transport) {
    console.log("[Email] (simulated) To:", to);
    console.log("[Email] Subject:", subject);
    console.log("[Email] Body:", text || html?.substring(0, 200));
    return { simulated: true };
  }

  const result = await transport.sendMail({ from, to, subject, html, text });
  console.log("[Email] Sent to", to, "| MessageID:", result.messageId);
  return result;
}

// ─── Email Templates ─────────────────────────────────────────────────────────

export function bookingConfirmationEmail({ patientName, doctorName, date, time }) {
  return {
    subject: `✅ Appointment Confirmed — Dr. ${doctorName}`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">Appointment Confirmed 🎉</h1>
        </div>
        <div style="padding: 24px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
          <p>Hello <strong>${patientName}</strong>,</p>
          <p>Your appointment has been successfully booked:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; font-weight: bold;">Doctor</td><td style="padding: 8px;">Dr. ${doctorName}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Date</td><td style="padding: 8px;">${date}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Time</td><td style="padding: 8px;">${time}</td></tr>
          </table>
          <p>You will receive a reminder 24 hours and 1 hour before your appointment.</p>
          <p style="color: #6c757d; font-size: 0.85rem;">— Healthcare Appointment Manager</p>
        </div>
      </div>
    `,
  };
}

export function reminderEmail({ patientName, doctorName, date, time, hoursUntil }) {
  return {
    subject: `⏰ Reminder: Appointment with Dr. ${doctorName} in ${hoursUntil}`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">Appointment Reminder ⏰</h1>
        </div>
        <div style="padding: 24px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
          <p>Hello <strong>${patientName}</strong>,</p>
          <p>This is a reminder that your appointment is coming up in <strong>${hoursUntil}</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; font-weight: bold;">Doctor</td><td style="padding: 8px;">Dr. ${doctorName}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Date</td><td style="padding: 8px;">${date}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Time</td><td style="padding: 8px;">${time}</td></tr>
          </table>
          <p style="color: #6c757d; font-size: 0.85rem;">— Healthcare Appointment Manager</p>
        </div>
      </div>
    `,
  };
}

export function leaveNoticeEmail({ patientName, doctorName, date, rebookingLink }) {
  return {
    subject: `📅 Appointment Cancelled — Dr. ${doctorName} on leave`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ffa726 0%, #fb8c00 100%); padding: 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">Appointment Rescheduled 📅</h1>
        </div>
        <div style="padding: 24px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
          <p>Hello <strong>${patientName}</strong>,</p>
          <p>Unfortunately, Dr. ${doctorName} has marked <strong>${date}</strong> as a leave day. Your appointment has been cancelled.</p>
          <p><a href="${rebookingLink}" style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Rebook Appointment →</a></p>
          <p>We apologize for the inconvenience.</p>
          <p style="color: #6c757d; font-size: 0.85rem;">— Healthcare Appointment Manager</p>
        </div>
      </div>
    `,
  };
}

export function medicationReminderEmail({ patientName, drugName, instructions }) {
  return {
    subject: `💊 Medication Reminder: ${drugName}`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); padding: 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">Medication Reminder 💊</h1>
        </div>
        <div style="padding: 24px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
          <p>Hello <strong>${patientName}</strong>,</p>
          <p>Time to take your medication:</p>
          <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #43e97b; margin: 16px 0;">
            <strong>${drugName}</strong><br/>
            <span style="color: #6c757d;">${instructions}</span>
          </div>
          <p style="color: #6c757d; font-size: 0.85rem;">— Healthcare Appointment Manager</p>
        </div>
      </div>
    `,
  };
}

export function postVisitSummaryEmail({ patientName, doctorName, summary, medicationSchedule, followUpSteps }) {
  const medsHtml = (medicationSchedule || [])
    .map((m) => `<li><strong>${m.drug}</strong>: ${m.instructions}</li>`)
    .join("");
  const stepsHtml = (followUpSteps || [])
    .map((s) => `<li>${s}</li>`)
    .join("");

  return {
    subject: `📋 Post-Visit Summary — Dr. ${doctorName}`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">Your Visit Summary 📋</h1>
        </div>
        <div style="padding: 24px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
          <p>Hello <strong>${patientName}</strong>,</p>
          <p>${summary || "Summary is being generated. Please check back later."}</p>
          ${medsHtml ? `<h3>Medications</h3><ul>${medsHtml}</ul>` : ""}
          ${stepsHtml ? `<h3>Follow-up Steps</h3><ul>${stepsHtml}</ul>` : ""}
          <p style="color: #6c757d; font-size: 0.85rem;">— Healthcare Appointment Manager</p>
        </div>
      </div>
    `,
  };
}

export function appointmentCancellationEmail({ patientName, doctorName, date, time }) {
  return {
    subject: `❌ Appointment Cancelled — Dr. ${doctorName}`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f87171 0%, #ef4444 100%); padding: 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">Appointment Cancelled ❌</h1>
        </div>
        <div style="padding: 24px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
          <p>Hello,</p>
          <p>The appointment between patient <strong>${patientName}</strong> and <strong>Dr. ${doctorName}</strong> scheduled for <strong>${date}</strong> at <strong>${time}</strong> has been cancelled.</p>
          <p>If you wish to reschedule, please visit the portal.</p>
          <p style="color: #6c757d; font-size: 0.85rem;">— Healthcare Appointment Manager</p>
        </div>
      </div>
    `,
  };
}

export function doctorBookingConfirmationEmail({ patientName, doctorName, date, time, chiefComplaint, urgencyLevel }) {
  return {
    subject: `📅 New Booking Alert — Patient: ${patientName}`,
    html: `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">New Appointment Booked 📅</h1>
        </div>
        <div style="padding: 24px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
          <p>Hello <strong>Dr. ${doctorName}</strong>,</p>
          <p>A new patient has scheduled an appointment with you:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; font-weight: bold; width: 30%;">Patient Name</td><td style="padding: 8px;">${patientName}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Date</td><td style="padding: 8px;">${date}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Time</td><td style="padding: 8px;">${time}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Chief Complaint</td><td style="padding: 8px;">${chiefComplaint || "No symptoms described"}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Urgency Level</td><td style="padding: 8px; font-weight: bold; color: ${urgencyLevel === "High" ? "#ef4444" : urgencyLevel === "Medium" ? "#f59e0b" : "#10b981"};">${urgencyLevel || "Low"}</td></tr>
          </table>
          <p>Please review the pre-visit triage summary on your dashboard prior to the appointment.</p>
          <p style="color: #6c757d; font-size: 0.85rem;">— Healthcare Appointment Manager</p>
        </div>
      </div>
    `,
  };
}

export default {
  sendEmail,
  bookingConfirmationEmail,
  doctorBookingConfirmationEmail,
  reminderEmail,
  leaveNoticeEmail,
  medicationReminderEmail,
  postVisitSummaryEmail,
  appointmentCancellationEmail,
};
