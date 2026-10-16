import { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 1200;

const store = new Map<string, RateLimitEntry>();

/** Hard ceiling so a flood of distinct source IPs cannot grow the map without bound. */
const MAX_TRACKED_CLIENTS = 10_000;

/**
 * Drops entries whose window has elapsed.
 *
 * Previously entries were only ever replaced, never deleted. Because this
 * middleware is mounted globally and the server binds 0.0.0.0, every distinct
 * source IP added a permanent key - a memory leak that grows the more the app is
 * scanned. Sweeping on a timer keeps the map proportional to *recent* clients.
 */
function sweepExpired(now: number): void {
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

let lastSweepAt = 0;

function getClientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function rateLimit(options?: { windowMs?: number; max?: number }) {
  const windowMs = options?.windowMs || RATE_LIMIT_WINDOW_MS;
  const max = options?.max || DEFAULT_MAX_REQUESTS;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = getClientKey(req);
    const now = Date.now();

    // At most one sweep per window, and only once the map is large enough to matter.
    if (now - lastSweepAt > windowMs) {
      lastSweepAt = now;
      if (store.size > 1000) sweepExpired(now);
    }

    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      // Evict if full so a spoofed-IP flood cannot pin memory indefinitely.
      if (store.size >= MAX_TRACKED_CLIENTS) sweepExpired(now);
      if (store.size >= MAX_TRACKED_CLIENTS) store.clear();
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ error: "Too many requests" });
    }

    next();
  };
}
