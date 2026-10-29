import { Router, type IRouter } from "express";
import healthRouter from "./health";
import profileRouter from "./profile";
import studyRouter from "./study";
import studySetsRouter from "./study-sets";

const router: IRouter = Router();

router.use(healthRouter);
router.use(profileRouter);
router.use(studyRouter);
router.use(studySetsRouter);

export default router;
