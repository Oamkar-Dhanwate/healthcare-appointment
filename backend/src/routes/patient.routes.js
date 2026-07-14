// ─── Patient Routes ──────────────────────────────────────────────────────────

import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { roleGuard } from "../middleware/roleGuard.middleware.js";
import {
  searchDoctors,
  getDoctorSlots,
  holdSlot,
  confirmAppointment,
  cancelAppointment,
  getMyAppointments,
  getPostVisitSummary,
} from "../controllers/patient.controller.js";

const router = Router();

// Public: search doctors and view slots
router.get("/doctors", searchDoctors);
router.get("/doctors/:id/slots", getDoctorSlots);

// Protected: patient-only actions
router.post(
  "/appointments/hold",
  authenticate,
  roleGuard("patient"),
  holdSlot
);
router.post(
  "/appointments/:id/confirm",
  authenticate,
  roleGuard("patient"),
  confirmAppointment
);
router.post(
  "/appointments/:id/cancel",
  authenticate,
  roleGuard("patient"),
  cancelAppointment
);
router.get(
  "/appointments/me",
  authenticate,
  roleGuard("patient"),
  getMyAppointments
);
router.get(
  "/appointments/:id/summary",
  authenticate,
  roleGuard("patient"),
  getPostVisitSummary
);

export default router;
