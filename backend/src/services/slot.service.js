// ─── Slot Service ────────────────────────────────────────────────────────────
// Computes available appointment slots for a doctor on a given date.
// Formula: workingHours − leaveDays − confirmedBookings − activeHolds

import prisma from "../config/db.js";

const DAY_MAP = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

/**
 * Generate all possible time slots for a doctor on a date,
 * then subtract booked/held slots.
 *
 * @param {number} doctorId
 * @param {string} dateStr - "YYYY-MM-DD"
 * @returns {Array<{start: string, end: string, available: boolean}>}
 */
export async function getAvailableSlots(doctorId, dateStr) {
  const date = new Date(dateStr);
  const dayKey = DAY_MAP[date.getDay()];

  // 1. Fetch doctor profile
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: {
      leaves: {
        where: { leaveDate: date },
      },
    },
  });

  if (!doctor) {
    throw Object.assign(new Error("Doctor not found"), { statusCode: 404 });
  }

  // 2. Check if doctor is on leave
  if (doctor.leaves.length > 0) {
    return []; // No slots — doctor on leave
  }

  // 3. Parse working hours for this day of the week
  const workingHours =
    typeof doctor.workingHours === "string"
      ? JSON.parse(doctor.workingHours)
      : doctor.workingHours || {};

  const dayHours = workingHours[dayKey];
  const slotDuration = doctor.slotDurationMin || 15;

  let allSlots = [];

  // Generate default weekday slots if the doctor works this day
  if (dayHours && dayHours.length >= 2) {
    const [startTime, endTime] = dayHours;
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);

    let currentMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    while (currentMinutes + slotDuration <= endMinutes) {
      const slotStartH = Math.floor(currentMinutes / 60);
      const slotStartM = currentMinutes % 60;
      const slotEndMinutes = currentMinutes + slotDuration;
      const slotEndH = Math.floor(slotEndMinutes / 60);
      const slotEndM = slotEndMinutes % 60;

      const slotStart = new Date(date);
      slotStart.setHours(slotStartH, slotStartM, 0, 0);

      const slotEnd = new Date(date);
      slotEnd.setHours(slotEndH, slotEndM, 0, 0);

      allSlots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        startFormatted: `${String(slotStartH).padStart(2, "0")}:${String(slotStartM).padStart(2, "0")}`,
        endFormatted: `${String(slotEndH).padStart(2, "0")}:${String(slotEndM).padStart(2, "0")}`,
      });

      currentMinutes = slotEndMinutes;
    }
  }

  // 4. Inject manually self-entered custom slots for this specific date
  const customSlots = workingHours.customSlots || [];
  customSlots.forEach((slot) => {
    if (slot.date === dateStr) {
      const [startH, startM] = slot.start.split(":").map(Number);
      const [endH, endM] = slot.end.split(":").map(Number);

      const slotStart = new Date(date);
      slotStart.setHours(startH, startM, 0, 0);

      const slotEnd = new Date(date);
      slotEnd.setHours(endH, endM, 0, 0);

      allSlots.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
        startFormatted: slot.start,
        endFormatted: slot.end,
        isCustom: true,
        isAiGenerated: slot.isAiGenerated || false,
      });
    }
  });

  // 5. Remove manually deleted/cancelled slots for this specific date
  const removedSlots = workingHours.removedSlots || [];
  const removedTimes = new Set(
    removedSlots
      .filter((s) => s.date === dateStr)
      .map((s) => s.start)
  );

  allSlots = allSlots.filter((slot) => !removedTimes.has(slot.startFormatted));

  // Deduplicate slots by starting time (e.g. if a custom slot overlaps a weekday slot)
  const seenStarts = new Set();
  const dedupedSlots = [];
  allSlots.forEach((slot) => {
    if (!seenStarts.has(slot.start)) {
      seenStarts.add(slot.start);
      dedupedSlots.push(slot);
    }
  });

  // Sort slots chronologically
  dedupedSlots.sort((a, b) => new Date(a.start) - new Date(b.start));

  // 6. Fetch existing bookings + active holds for this doctor on this date
  // Use UTC midnight boundaries — DB stores UTC, dateStr is YYYY-MM-DD local date
  const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
  const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      slotStart: { gte: dayStart, lte: dayEnd },
      OR: [
        { status: "confirmed" },
        { status: "completed" },
        {
          status: "held",
          holdExpiresAt: { gt: new Date() }, // only unexpired holds
        },
      ],
    },
    select: { slotStart: true },
  });

  const bookedTimes = new Set(
    existingAppointments.map((a) => a.slotStart.toISOString())
  );

  // 7. Mark availability
  return dedupedSlots.map((slot) => ({
    ...slot,
    available: !bookedTimes.has(slot.start),
  }));
}

/**
 * Validate that a specific slot is still available for booking.
 */
export async function isSlotAvailable(doctorId, slotStart) {
  const existing = await prisma.appointment.findFirst({
    where: {
      doctorId,
      slotStart: new Date(slotStart),
      OR: [
        { status: "confirmed" },
        { status: "completed" },
        {
          status: "held",
          holdExpiresAt: { gt: new Date() },
        },
      ],
    },
  });

  return !existing;
}

/**
 * AI pattern learning: Predicts preferred booking slots based on past appointments and populates next day's slots.
 */
export async function generateSlotsFromPatterns(doctorId, dateStr) {
  // Analyze last 30 days of appointment booking hours to find patterns
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const history = await prisma.appointment.findMany({
    where: {
      doctorId,
      slotStart: { gte: thirtyDaysAgo },
      status: { in: ["confirmed", "completed"] },
    },
    select: { slotStart: true },
  });

  const timeCounts = {};
  history.forEach((apt) => {
    // Format to HH:MM in local timezone
    const timeStr = new Date(apt.slotStart).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    timeCounts[timeStr] = (timeCounts[timeStr] || 0) + 1;
  });

  let predictedTimes = [];
  const sortedTimes = Object.keys(timeCounts).sort((a, b) => timeCounts[b] - timeCounts[a]);

  if (sortedTimes.length > 0) {
    // Top 5 slots the doctor gets booked at most frequently
    predictedTimes = sortedTimes.slice(0, 5);
  } else {
    // Default patterns if there is no historical data yet
    predictedTimes = ["09:00", "10:30", "14:00", "15:30"];
  }

  // Fetch doctor to append custom slots
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
  });

  if (!doctor) throw new Error("Doctor not found");

  const workingHours =
    typeof doctor.workingHours === "string"
      ? JSON.parse(doctor.workingHours)
      : doctor.workingHours || {};

  const customSlots = workingHours.customSlots || [];

  // Exclude existing custom slots for the target date to avoid duplicates
  const otherCustomSlots = customSlots.filter((s) => s.date !== dateStr);

  const slotDuration = doctor.slotDurationMin || 15;

  const newCustomSlots = predictedTimes.map((timeStr) => {
    const [h, m] = timeStr.split(":").map(Number);
    const endMinutes = h * 60 + m + slotDuration;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;
    const endFormatted = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

    return {
      date: dateStr,
      start: timeStr,
      end: endFormatted,
      isAiGenerated: true,
    };
  });

  workingHours.customSlots = [...otherCustomSlots, ...newCustomSlots];

  await prisma.doctor.update({
    where: { id: doctorId },
    data: { workingHours },
  });

  return newCustomSlots;
}

export default { getAvailableSlots, isSlotAvailable, generateSlotsFromPatterns };
