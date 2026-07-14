// ─── Centralized Error Handler ────────────────────────────────────────────────
// Catches all unhandled errors and returns a consistent JSON response.

export function errorHandler(err, _req, res, _next) {
  console.error("[Error]", err.stack || err.message || err);

  // Prisma known errors
  if (err.code === "P2002") {
    return res.status(409).json({
      error: "Conflict",
      message: "A record with that unique value already exists.",
      field: err.meta?.target,
    });
  }

  if (err.code === "P2025") {
    return res.status(404).json({
      error: "Not found",
      message: "The requested record does not exist.",
    });
  }

  // Validation errors (custom)
  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation error",
      message: err.message,
      details: err.details || undefined,
    });
  }

  // JWT errors (fallthrough from middleware)
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? "Internal server error" : err.message,
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
      details: err.message,
    }),
  });
}

export default errorHandler;
