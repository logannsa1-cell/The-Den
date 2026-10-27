import express, { Router, type ErrorRequestHandler } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { extractSource, MAX_SOURCE_BYTES, sourceExtensions } from "../lib/source-extractor";

const router = Router();
const active = new Set<string>();
// No queue: bounded work prevents uploads from stalling normal study-set requests.
router.post("/api/study/extract", requireAuth, (req, res, next) => {
  const user = res.locals.userId as string;
  if (active.size >= 2 || active.has(user)) {
    res.setHeader("Retry-After", "5");
    res.status(429).json({ error: "Another document is being read. Please retry in a few seconds." });
    return;
  }
  active.add(user);
  const release = () => active.delete(user);
  res.once("finish", release);
  res.once("close", release);
  next();
}, express.json({ limit: "21mb" }), async (req, res) => {
  const { name, base64 } = req.body ?? {};
  if (typeof name !== "string" || !name.trim() || name.length > 160 ||
      !sourceExtensions.has(name.split(".").pop()!.toLowerCase()) ||
      typeof base64 !== "string" || !base64.length ||
      base64.length > 4 * Math.ceil(MAX_SOURCE_BYTES / 3) ||
      base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    res.status(400).json({ error: "Choose a valid PDF, PPTX, DOCX, TXT, MD or CSV file up to 15 MB." });
    return;
  }
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length || bytes.length > MAX_SOURCE_BYTES) {
    res.status(413).json({ error: "Each file must be no larger than 15 MB." });
    return;
  }
  const controller = new AbortController();
  const disconnect = () => { if (!res.writableEnded) controller.abort(); };
  res.once("close", disconnect);
  // Free the base64 copy before parsing; neither bytes nor extracted content are logged.
  req.body = undefined;
  try {
    const result = await extractSource(name, bytes, controller.signal);
    if (!res.destroyed) res.json({ name, ...result });
  } catch (error) {
    if (!res.destroyed) res.status(400).json({ error: error instanceof Error ? error.message : "This document could not be read." });
  } finally { res.off("close", disconnect); }
});
const uploadError: ErrorRequestHandler = (error, _req, res, _next) => {
  res.status(error?.type === "entity.too.large" ? 413 : 400).json({
    error: error?.type === "entity.too.large" ? "Each file must be no larger than 15 MB." : "The upload could not be read. Please select the file again.",
  });
};
router.use(uploadError);
export default router;
