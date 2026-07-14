// ─── Admin Routes ────────────────────────────────────────────────────────────

import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { roleGuard } from "../middleware/roleGuard.middleware.js";
import {
  createDoctor,
  updateDoctor,
  listDoctors,
  markLeave,
  listAllAppointments,
  getDashboard,
  getFailedNotifications,
} from "../controllers/admin.controller.js";

const router = Router();

// All admin routes require admin role
router.use(authenticate, roleGuard("admin"));

router.post("/doctors", createDoctor);
router.put("/doctors/:id", updateDoctor);
router.get("/doctors", listDoctors);
router.post("/doctors/:id/leaves", markLeave);
router.get("/appointments", listAllAppointments);
router.get("/dashboard", getDashboard);
router.get("/notifications/failed", getFailedNotifications);

export default router;
