// ─── Auth Controller ─────────────────────────────────────────────────────────
// Handles user registration, login (JWT), and Google OAuth for Calendar access.

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/db.js";
import { getGoogleOAuth2Client, getGoogleAuthUrl } from "../config/google.js";

const JWT_EXPIRY = "7d";

/**
 * POST /api/v1/auth/register
 */
export async function register(req, res, next) {
  try {
    const { email, password, fullName, phone, role } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({
        error: "Missing required fields: email, password, fullName",
      });
    }

    // Only patients can self-register; admin/doctor created by admin
    const userRole = role === "doctor" || role === "admin" ? role : "patient";
    const isDoctor = userRole === "doctor";
    const specialisation = req.body.specialisation || "General Medicine";
    const consultationFee = req.body.consultationFee ? Number(req.body.consultationFee) : null;
    const workingHours = req.body.workingHours || {
      mon: ["09:00", "17:00"],
      tue: ["09:00", "17:00"],
      wed: ["09:00", "17:00"],
      thu: ["09:00", "17:00"],
      fri: ["09:00", "17:00"],
      customSlots: [],
      removedSlots: []
    };

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        role: userRole,
        fullName: fullName.trim(),
        phone: phone || null,
        ...(isDoctor && {
          doctorProfile: {
            create: {
              specialisation,
              slotDurationMin: req.body.slotDurationMin || 15,
              workingHours,
              consultationFee,
            },
          },
        }),
      },
      include: {
        doctorProfile: isDoctor,
      },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/login
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/auth/google
 * Redirects user to Google OAuth consent screen for Calendar access.
 */
export async function googleAuth(req, res, next) {
  try {
    const url = getGoogleAuthUrl(req.user.id.toString());
    if (!url) {
      return res
        .status(503)
        .json({ error: "Google Calendar integration is not configured" });
    }
    res.json({ url });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/auth/google/callback
 * Handles the OAuth callback — exchanges code for tokens, stores refresh token.
 */
export async function googleCallback(req, res, next) {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }

    const client = getGoogleOAuth2Client();
    if (!client) {
      return res
        .status(503)
        .json({ error: "Google Calendar integration is not configured" });
    }

    const { tokens } = await client.getToken(code);

    // Store refresh token against the authenticated user (using state as user ID)
    if (state && tokens.refresh_token) {
      await prisma.user.update({
        where: { id: parseInt(state, 10) },
        data: { googleRefreshToken: tokens.refresh_token },
      });
    }

    // Redirect to frontend with success indicator
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    res.redirect(`${clientUrl}/calendar-connected?success=true`);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/auth/me
 * Returns the current user's profile.
 */
export async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        createdAt: true,
        googleRefreshToken: false,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export default { register, login, googleAuth, googleCallback, getMe };
