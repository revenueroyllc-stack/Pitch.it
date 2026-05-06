import { Router, type IRouter } from "express";
import healthRouter from "./health";
import saynowRouter from "./saynow";

const router: IRouter = Router();

router.use(healthRouter);
router.use(saynowRouter);

export default router;
