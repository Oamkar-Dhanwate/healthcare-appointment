// ─── BullMQ Queue Definitions ────────────────────────────────────────────────
// Defines all named queues used by the background job system.

import { Queue } from "bullmq";
import { getRedisConnection } from "../config/redis.js";

let queues = null;

export function getQueues() {
  if (queues) return queues;

  const connection = getRedisConnection();
  if (!connection) {
    console.warn("[Jobs] Redis unavailable — background jobs disabled");
    return {};
  }

  queues = {
    sweepHolds: new Queue("sweep-expired-holds", { connection }),
    appointmentReminders: new Queue("appointment-reminders", { connection }),
    medicationReminders: new Queue("medication-reminders", { connection }),
    retryNotifications: new Queue("retry-failed-notifications", { connection }),
    retryAiSummaries: new Queue("retry-failed-ai-summaries", { connection }),
    leaveConflict: new Queue("leave-conflict", { connection }),
    dailySlots: new Queue("daily-slots", { connection }),
  };

  console.log("[Jobs] Queues initialized");
  return queues;
}

export default getQueues;
