// ─── Background Worker Entry Point ───────────────────────────────────────────
// Starts all BullMQ workers and repeatable cron-like jobs.
// Run separately: npm run worker

import "dotenv/config";
import { Worker } from "bullmq";
import { getRedisConnection } from "../config/redis.js";
import { sweepExpiredHolds } from "./sweepExpiredHolds.js";
import { sendAppointmentReminders } from "./sendAppointmentReminders.js";
import { sendMedicationReminders } from "./sendMedicationReminders.js";
import { retryFailedNotifications } from "./retryFailedNotifications.js";
import { retryFailedAiSummaries } from "./retryFailedAiSummaries.js";
import { handleLeaveConflict } from "./leaveConflict.js";
import { generateDailySlots } from "./generateDailySlots.js";

const connection = getRedisConnection();

if (!connection) {
  console.error(
    "[Worker] Redis is not available. Background jobs cannot start."
  );
  console.error(
    "[Worker] Set REDIS_URL in .env and ensure Redis is running."
  );
  process.exit(1);
}

console.log("\n🔧 Starting background workers...\n");

// ─── Workers ─────────────────────────────────────────────────────────────────

// Sweep expired holds — every 1 minute
const sweepWorker = new Worker(
  "sweep-expired-holds",
  async () => sweepExpiredHolds(),
  { connection }
);

// Appointment reminders — every 5 minutes
const reminderWorker = new Worker(
  "appointment-reminders",
  async () => sendAppointmentReminders(),
  { connection }
);

// Medication reminders — every 5 minutes
const medReminderWorker = new Worker(
  "medication-reminders",
  async () => sendMedicationReminders(),
  { connection }
);

// Retry failed notifications — every 5 minutes
const retryNotifsWorker = new Worker(
  "retry-failed-notifications",
  async () => retryFailedNotifications(),
  { connection }
);

// Retry failed AI summaries — every 10 minutes
const retryAiWorker = new Worker(
  "retry-failed-ai-summaries",
  async () => retryFailedAiSummaries(),
  { connection }
);

// Leave conflict handler — triggered on demand
const leaveConflictWorker = new Worker(
  "leave-conflict",
  async (job) => handleLeaveConflict(job.data),
  { connection }
);

// Daily slot pattern learning generator
const dailySlotsWorker = new Worker(
  "daily-slots",
  async () => generateDailySlots(),
  { connection }
);

// ─── Repeatable Jobs Setup ───────────────────────────────────────────────────

import { getQueues } from "./queues.js";

async function setupRepeatableJobs() {
  const queues = getQueues();
  if (!queues.sweepHolds) return;

  // Add repeatable (cron-like) jobs
  await queues.sweepHolds.add("sweep", {}, { repeat: { every: 60_000 } });
  await queues.appointmentReminders.add("check", {}, { repeat: { every: 300_000 } });
  await queues.medicationReminders.add("check", {}, { repeat: { every: 300_000 } });
  await queues.retryNotifications.add("retry", {}, { repeat: { every: 300_000 } });
  await queues.retryAiSummaries.add("retry", {}, { repeat: { every: 600_000 } });
  await queues.dailySlots.add("generate", {}, { repeat: { pattern: "0 0 * * *" } }); // daily at midnight

  console.log("[Worker] Repeatable jobs scheduled");
}

setupRepeatableJobs().catch((err) =>
  console.error("[Worker] Failed to set up repeatable jobs:", err.message)
);

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

const workers = [
  sweepWorker,
  reminderWorker,
  medReminderWorker,
  retryNotifsWorker,
  retryAiWorker,
  leaveConflictWorker,
  dailySlotsWorker,
];

async function shutdown() {
  console.log("\n[Worker] Shutting down gracefully...");
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("✅ All workers started:\n");
console.log("  • sweep-expired-holds      (every 1 min)");
console.log("  • appointment-reminders     (every 5 min)");
console.log("  • medication-reminders      (every 5 min)");
console.log("  • retry-failed-notifications (every 5 min)");
console.log("  • retry-failed-ai-summaries  (every 10 min)");
console.log("  • leave-conflict            (on-demand)");
console.log("  • daily-slots               (daily cron at midnight)\n");
