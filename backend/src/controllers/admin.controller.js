// ─── Admin Controller ────────────────────────────────────────────────────────
// Manages doctor profiles, leave days, and admin dashboard data.

import bcrypt from "bcryptjs";
import prisma from "../config/db.js";

/**
 * POST /api/v1/admin/doctors
 * Create a new doctor profile (also creates the user record).
 */
export async function createDoctor(req, res, next) {
  try {
    const {
      email,
      password,
      fullName,
      phone,
      specialisation,
      slotDurationMin,
      workingHours,
      consultationFee,
    } = req.body;

    if (!email || !password || !fullName || !specialisation || !workingHours) {
      return res.status(400).json({
        error:
          "Required fields: email, password, fullName, specialisation, workingHours",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        role: "doctor",
        fullName: fullName.trim(),
        phone: phone || null,
        doctorProfile: {
          create: {
            specialisation: specialisation.trim(),
            slotDurationMin: slotDurationMin || 15,
            workingHours,
            consultationFee: consultationFee || null,
          },
        },
      },
      include: { doctorProfile: true },
    });

    res.status(201).json({
      message: "Doctor profile created",
      doctor: {
        id: user.doctorProfile.id,
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        specialisation: user.doctorProfile.specialisation,
        slotDurationMin: user.doctorProfile.slotDurationMin,
        workingHours: user.doctorProfile.workingHours,
        consultationFee: user.doctorProfile.consultationFee,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/admin/doctors/:id
 * Update doctor profile (working hours, specialisation, slot duration, fee).
 */
export async function updateDoctor(req, res, next) {
  try {
    const { id } = req.params;
    const { specialisation, slotDurationMin, workingHours, consultationFee } =
      req.body;

    const doctor = await prisma.doctor.update({
      where: { id: Number(id) },
      data: {
        ...(specialisation && { specialisation }),
        ...(slotDurationMin && { slotDurationMin }),
        ...(workingHours && { workingHours }),
        ...(consultationFee !== undefined && { consultationFee }),
      },
      include: { user: { select: { fullName: true, email: true } } },
    });

    res.json({ message: "Doctor profile updated", doctor });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/doctors
 * List all doctors with their profiles.
 */
export async function listDoctors(req, res, next) {
  try {
    const doctors = await prisma.doctor.findMany({
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        _count: { select: { appointments: true } },
      },
      orderBy: { user: { fullName: "asc" } },
    });

    res.json({ doctors });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/doctors/:id/leaves
 * Mark a leave day for a doctor. Triggers leave-conflict handling.
 */
export async function markLeave(req, res, next) {
  try {
    const { id } = req.params;
    const { leaveDate, reason } = req.body;

    if (!leaveDate) {
      return res.status(400).json({ error: "leaveDate is required" });
    }

    const leave = await prisma.doctorLeave.create({
      data: {
        doctorId: Number(id),
        leaveDate: new Date(leaveDate),
        reason: reason || null,
      },
    });

    // Find conflicting confirmed appointments on the leave date
    const dayStart = new Date(leaveDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(leaveDate);
    dayEnd.setHours(23, 59, 59, 999);

    const conflictingAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: Number(id),
        status: "confirmed",
        slotStart: { gte: dayStart, lte: dayEnd },
      },
      include: {
        patient: { select: { id: true, email: true, fullName: true } },
      },
    });

    // Cancel conflicting appointments
    if (conflictingAppointments.length > 0) {
      await prisma.appointment.updateMany({
        where: {
          id: { in: conflictingAppointments.map((a) => a.id) },
        },
        data: { status: "leave_cancelled" },
      });

      // Queue leave notice notifications for each affected patient
      const notifications = conflictingAppointments.map((apt) => ({
        userId: apt.patient.id,
        type: "leave_notice",
        channel: "email",
        status: "queued",
        payload: {
          appointmentId: apt.id,
          doctorId: Number(id),
          patientEmail: apt.patient.email,
          patientName: apt.patient.fullName,
          slotStart: apt.slotStart.toISOString(),
        },
      }));

      await prisma.notification.createMany({ data: notifications });
    }

    res.status(201).json({
      message: "Leave marked successfully",
      leave,
      cancelledAppointments: conflictingAppointments.length,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/appointments
 * View all appointments with filters.
 */
export async function listAllAppointments(req, res, next) {
  try {
    const { status, date, doctorId, page = 1, limit = 20 } = req.query;

    const where = {};
    if (status) where.status = status;
    if (doctorId) where.doctorId = Number(doctorId);
    if (date) {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      where.slotStart = { gte: dayStart, lte: dayEnd };
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          doctor: {
            include: {
              user: { select: { fullName: true, email: true } },
            },
          },
          patient: { select: { id: true, fullName: true, email: true } },
          symptomForm: true,
        },
        orderBy: { slotStart: "desc" },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      prisma.appointment.count({ where }),
    ]);

    res.json({
      appointments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/dashboard
 * Admin overview stats.
 */
export async function getDashboard(req, res, next) {
  try {
    const [totalDoctors, totalPatients, totalAppointments, todayAppointments, failedNotifications] =
      await Promise.all([
        prisma.doctor.count(),
        prisma.user.count({ where: { role: "patient" } }),
        prisma.appointment.count(),
        prisma.appointment.count({
          where: {
            slotStart: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lte: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
        }),
        prisma.notification.count({ where: { status: "failed" } }),
      ]);

    res.json({
      stats: {
        totalDoctors,
        totalPatients,
        totalAppointments,
        todayAppointments,
        failedNotifications,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/admin/notifications/failed
 * View failed notifications for manual review.
 */
export async function getFailedNotifications(req, res, next) {
  try {
    const notifications = await prisma.notification.findMany({
      where: { status: "failed" },
      include: {
        user: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json({ notifications });
  } catch (err) {
    next(err);
  }
}

export default {
  createDoctor,
  updateDoctor,
  listDoctors,
  markLeave,
  listAllAppointments,
  getDashboard,
  getFailedNotifications,
};
