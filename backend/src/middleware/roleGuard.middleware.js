// ─── Role Guard Middleware ────────────────────────────────────────────────────
// Restricts access to routes based on user role(s).
// Usage: router.get("/admin/dashboard", authenticate, roleGuard("admin"), handler)
//        router.get("/shared", authenticate, roleGuard("admin", "doctor"), handler)

export function roleGuard(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Access denied",
        message: `This resource requires one of the following roles: ${allowedRoles.join(", ")}`,
      });
    }

    next();
  };
}

export default roleGuard;
