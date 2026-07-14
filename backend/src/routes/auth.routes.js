// ─── Auth Routes ─────────────────────────────────────────────────────────────

import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import {
  register,
  login,
  googleAuth,
  googleCallback,
  getMe,
} from "../controllers/auth.controller.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/google", authenticate, googleAuth);
router.get("/google/callback", googleCallback);
router.get("/me", authenticate, getMe);

export default router;
