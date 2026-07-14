// ─── Express Application Entry Point ─────────────────────────────────────────

import "dotenv/config";
import express from "express";
import cors from "cors";

// Route imports
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import patientRoutes from "./routes/patient.routes.js";
import doctorRoutes from "./routes/doctor.routes.js";

// Middleware
import { errorHandler } from "./middleware/errorHandler.middleware.js";

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Global Middleware ───────────────────────────────────────────────────────

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Healthcare Appointment Manager",
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes ──────────────────────────────────────────────────────────────

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1", patientRoutes);        // /doctors, /appointments
app.use("/api/v1/doctor", doctorRoutes);

// ─── 404 Catch-all ───────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Error Handler ───────────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🏥 Healthcare API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
});

export default app;
