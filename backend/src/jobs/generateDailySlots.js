// ─── Daily Slots Generator Job ────────────────────────────────────────────────
// Analyzes patterns and generates tomorrow's slots for all doctors.

import prisma from "../config/db.js";
import { generateSlotsFromPatterns } from "../services/slot.service.js";

export async function generateDailySlots() {
  console.log("[Job] Generating tomorrow's slots from patterns...");

  try {
    const doctors = await prisma.doctor.findMany();
    const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let count = 0;
    for (const doc of doctors) {
      await generateSlotsFromPatterns(doc.id, tomorrowStr);
      count++;
    }

    console.log(`[Job] Successfully auto-generated slots for ${count} doctors on date ${tomorrowStr}`);
  } catch (err) {
    console.error("[Job] Daily slot generation failed:", err.message);
  }
}

export default generateDailySlots;
