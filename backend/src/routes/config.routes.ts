import { Router } from "express";
import { authenticate, authorize } from "@/middlewares/auth";
import * as ConfigController from "@/controllers/config.controller";

const router = Router();

router.get("/inactivity", authenticate, authorize("admin"), ConfigController.getInactivity);
router.post("/inactivity", authenticate, authorize("admin"), ConfigController.setInactivity);

export default router;
