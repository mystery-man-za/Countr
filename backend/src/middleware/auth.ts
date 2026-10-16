import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";

export function requireApiKey(expectedApiKey?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Fail closed. Previously an unset key returned next(), silently disabling
    // auth on every route that opted in.
    if (!expectedApiKey || expectedApiKey.trim() === "") {
      return res.status(503).json({
        error: "Endpoint disabled: SCALARAI_MCP_API_KEY is not configured",
      });
    }

    const provided = Buffer.from(req.headers.authorization || "");
    const expected = Buffer.from(`Bearer ${expectedApiKey}`);

    // Exact, constant-time comparison. `startsWith()` accepted any header that
    // merely began with the secret, e.g. "<key>_x" or "<key><another-token>".
    const authorized = provided.length === expected.length && timingSafeEqual(provided, expected);

    if (!authorized) {
      return res.status(401).json({ error: "Unauthorized: Invalid or missing Bearer token" });
    }
    next();
  };
}