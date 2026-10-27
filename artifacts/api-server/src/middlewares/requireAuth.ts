import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const auth = getAuth(req);
  const userId = auth.userId;
  if (!userId) {
    if (req.headers.authorization?.startsWith("Bearer ")) {
      const reason = (auth.debug() as { reason?: unknown }).reason;
      logger.warn({
        reason: typeof reason === "string" && /^[a-z_-]{1,80}$/i.test(reason) ? reason : "unavailable",
      }, "Mobile session verification rejected");
    }
    res.status(401).json({ error: "Sign in to access your study sets." });
    return;
  }

  res.locals.userId = userId;
  next();
}
