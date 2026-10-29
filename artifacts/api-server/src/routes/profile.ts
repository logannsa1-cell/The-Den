import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/profile", requireAuth, (_req, res): void => {
  res.json({ userId: res.locals.userId as string });
});

export default router;
