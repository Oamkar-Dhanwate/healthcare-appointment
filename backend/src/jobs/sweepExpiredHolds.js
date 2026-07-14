// ─── Sweep Expired Holds Job ─────────────────────────────────────────────────
// Runs every 1 minute. Releases appointment holds whose TTL has expired.

import prisma from "../config/db.js";

export async function sweepExpiredHolds() {
  try {
    const now = new Date();

    const result = await prisma.appointment.updateMany({
      where: {
        status: "held",
        holdExpiresAt: { lt: now },
      },
      data: {
        status: "cancelled",
      },
    });

    if (result.count > 0) {
      console.log(`[SweepHolds] Released ${result.count} expired hold(s)`);
    }

    return result.count;
  } catch (err) {
    console.error("[SweepHolds] Error:", err.message);
    throw err;
  }
}

export default sweepExpiredHolds;
