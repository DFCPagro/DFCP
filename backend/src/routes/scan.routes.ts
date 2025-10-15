import { Router } from "express";
import * as opsCtrl from "../controllers/ops.controller";
import { authenticate } from "../middlewares/auth";

const router = Router();

// any authenticated user can scan
router.post("/:token", authenticate, opsCtrl.scan);

export default router;
