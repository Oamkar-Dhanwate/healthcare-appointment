// ─── Retry Failed Notifications Job ──────────────────────────────────────────
// Runs every 5 minutes. Retries failed/queued notifications with exponential backoff.
// Backoff schedule: 1m → 5m → 15m → 1h → 6h (max 5 attempts).

import prisma from "../config/db.js";
import { sendEmail } from "../services/email.service.js";

const BACKOFF_MINUTES = [1, 5, 15, 60, 360];
const MAX_ATTEMPTS = 5;

export async function retryFailedNotifications() {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        status: { in: ["queued", "failed"] },
        attempts: { lt: MAX_ATTEMPTS },
      },
      include: {
        user: { select: { email: true, fullName: true } },
      },
      take: 20, // batch limit
    });

    let retried = 0;

    for (const notif of notifications) {
      // Check if enough time has passed based on backoff schedule
      if (notif.attempts > 0 && notif.createdAt) {
        const backoffMs =
          BACKOFF_MINUTES[Math.min(notif.attempts - 1, BACKOFF_MINUTES.length - 1)] *
          60 *
          1000;
        const nextRetryAt = new Date(notif.createdAt.getTime() + backoffMs);
        if (new Date() < nextRetryAt) continue;
      }

      try {
        if (notif.channel === "email") {
          const payload = notif.payload || {};
          await sendEmail({
            to: notif.user.email,
            subject: payload.subject || `Notification from Healthcare App`,
            html: payload.html || payload.body || "You have a new notification.",
          });
        }

        await prisma.notification.update({
          where: { id: notif.id },
          data: {
            status: "sent",
            attempts: notif.attempts + 1,
          },
        });

        retried++;
      } catch (err) {
        const newAttempts = notif.attempts + 1;
        await prisma.notification.update({
          where: { id: notif.id },
          data: {
            status: newAttempts >= MAX_ATTEMPTS ? "failed" : "queued",
            attempts: newAttempts,
            lastError: err.message,
          },
        });
      }
    }

    if (retried > 0) {
      console.log(`[RetryNotifs] Successfully retried ${retried} notification(s)`);
    }

    return retried;
  } catch (err) {
    console.error("[RetryNotifs] Error:", err.message);
    throw err;
  }
}

export default retryFailedNotifications;
