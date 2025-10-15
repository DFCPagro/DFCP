import { Router } from "express";
import * as opsCtrl from "../controllers/ops.controller";
import { authenticate, authorize } from "../middlewares/auth";

const router = Router();

router.post("/", authenticate, authorize("industrialDeliverer","tManager","admin"), opsCtrl.createDelivery);
router.post("/:farmerDeliveryId/stops/append", authenticate, authorize("industrialDeliverer","tManager","admin"), opsCtrl.appendContainerToStop);

export default router;
