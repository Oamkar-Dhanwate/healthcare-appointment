// ─── Google OAuth2 Client ────────────────────────────────────────────────────
// Provides a pre-configured Google OAuth2 client for Calendar API access.

import { google } from "googleapis";

let oauth2Client = null;

export function getGoogleOAuth2Client() {
  if (oauth2Client) return oauth2Client;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (
    !clientId ||
    clientId === "your_client_id.apps.googleusercontent.com" ||
    !clientSecret ||
    clientSecret === "your_client_secret"
  ) {
    console.warn(
      "[Google] No valid OAuth credentials found. Calendar features will be unavailable."
    );
    return null;
  }

  try {
    oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    console.log("[Google] OAuth2 client initialized");
  } catch (err) {
    console.error("[Google] Failed to initialize OAuth2 client:", err.message);
    oauth2Client = null;
  }

  return oauth2Client;
}

/**
 * Generate the Google OAuth consent URL for calendar access.
 */
export function getGoogleAuthUrl(state) {
  const client = getGoogleOAuth2Client();
  if (!client) return null;

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    state: state,
  });
}

/**
 * Get a Google Calendar service instance for a user with the given refresh token.
 */
export function getCalendarService(refreshToken) {
  const client = getGoogleOAuth2Client();
  if (!client || !refreshToken) return null;

  const userClient = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  userClient.setCredentials({ refresh_token: refreshToken });

  return google.calendar({ version: "v3", auth: userClient });
}

export default getGoogleOAuth2Client;
