// ─── Google Calendar Service ─────────────────────────────────────────────────
// Creates, updates, and deletes Google Calendar events for appointments.
// Fails silently — calendar outages never block the booking flow.

import { getCalendarService } from "../config/google.js";

/**
 * Create a Google Calendar event for an appointment.
 * @returns {string|null} The event ID, or null if calendar is unavailable.
 */
export async function createCalendarEvent({
  refreshToken,
  summary,
  description,
  startDateTime,
  endDateTime,
  attendeeEmail,
}) {
  const calendar = getCalendarService(refreshToken);
  if (!calendar) {
    console.warn("[Calendar] Service unavailable — skipping event creation");
    return null;
  }

  try {
    const event = {
      summary,
      description,
      start: {
        dateTime: startDateTime,
        timeZone: "Asia/Kolkata",
      },
      end: {
        dateTime: endDateTime,
        timeZone: "Asia/Kolkata",
      },
      attendees: attendeeEmail ? [{ email: attendeeEmail }] : [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 60 },
          { method: "email", minutes: 1440 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
      sendUpdates: "all",
    });

    console.log("[Calendar] Event created:", response.data.id);
    return response.data.id;
  } catch (err) {
    console.error("[Calendar] Failed to create event:", err.message);
    return null;
  }
}

/**
 * Update an existing Google Calendar event.
 */
export async function updateCalendarEvent({
  refreshToken,
  eventId,
  updates,
}) {
  const calendar = getCalendarService(refreshToken);
  if (!calendar || !eventId) return null;

  try {
    const response = await calendar.events.patch({
      calendarId: "primary",
      eventId,
      resource: updates,
      sendUpdates: "all",
    });

    console.log("[Calendar] Event updated:", eventId);
    return response.data;
  } catch (err) {
    console.error("[Calendar] Failed to update event:", err.message);
    return null;
  }
}

/**
 * Delete a Google Calendar event.
 */
export async function deleteCalendarEvent({ refreshToken, eventId }) {
  const calendar = getCalendarService(refreshToken);
  if (!calendar || !eventId) return false;

  try {
    await calendar.events.delete({
      calendarId: "primary",
      eventId,
      sendUpdates: "all",
    });

    console.log("[Calendar] Event deleted:", eventId);
    return true;
  } catch (err) {
    console.error("[Calendar] Failed to delete event:", err.message);
    return false;
  }
}

export default {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
};
