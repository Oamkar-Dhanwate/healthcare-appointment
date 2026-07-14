// ─── Doctor Routes ───────────────────────────────────────────────────────────

import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { roleGuard } from "../middleware/roleGuard.middleware.js";
import {
  getAppointments,
  getAppointmentDetail,
  submitNotes,
  getAvailability,
  addCustomSlot,
  removeSlot,
  triggerAiPatternGeneration,
} from "../controllers/doctor.controller.js";

const router = Router();

// All doctor routes require doctor role
router.use(authenticate, roleGuard("doctor"));

router.get("/appointments", getAppointments);
router.get("/appointments/:id", getAppointmentDetail);
router.post("/appointments/:id/notes", submitNotes);

// Slots management routes
router.get("/availability", getAvailability);
router.post("/slots/custom", addCustomSlot);
router.post("/slots/remove", removeSlot);
router.post("/slots/generate-ai", triggerAiPatternGeneration);

export default router;
