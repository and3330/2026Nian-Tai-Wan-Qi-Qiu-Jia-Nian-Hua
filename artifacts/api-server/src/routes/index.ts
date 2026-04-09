import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import registrationsRouter from "./registrations";
import newsRouter from "./news";
import contestantsRouter from "./contestants";
import sponsorsRouter from "./sponsors";
import exhibitionsRouter from "./exhibitions";
import adminRouter from "./admin";
import socialMarketingRouter from "./social-marketing";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(registrationsRouter);
router.use(newsRouter);
router.use(contestantsRouter);
router.use(sponsorsRouter);
router.use(exhibitionsRouter);
router.use(adminRouter);
router.use(socialMarketingRouter);

export default router;
