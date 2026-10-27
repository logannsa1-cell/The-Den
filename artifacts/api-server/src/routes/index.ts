import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studyRouter from "./study";
import studySetsRouter from "./study-sets";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studyRouter);
router.use(studySetsRouter);

export default router;
