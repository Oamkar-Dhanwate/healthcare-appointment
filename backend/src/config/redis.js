// ─── Redis + BullMQ Connection ───────────────────────────────────────────────
// Provides a shared Redis (IORedis) connection for BullMQ queues and workers.

import IORedis from "ioredis";

let redisConnection = null;

export function getRedisConnection() {
  if (redisConnection) return redisConnection;

  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  try {
    redisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 5000);
        console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      },
    });

    redisConnection.on("connect", () => console.log("[Redis] Connected"));
    redisConnection.on("error", (err) =>
      console.error("[Redis] Connection error:", err.message)
    );
  } catch (err) {
    console.error("[Redis] Failed to initialize:", err.message);
    redisConnection = null;
  }

  return redisConnection;
}

export default getRedisConnection;
