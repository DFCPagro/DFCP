import { Router } from "express";
import * as ctrl from "../controllers/itemPacking.controller";
import { authenticate, authenticateIfPresent, authorize } from "../middlewares/auth";
import { Role } from "../utils/constants";

const router = Router();

// Public GETs (auth optional)
 router.get("/", authenticateIfPresent, ctrl.list);
 router.get("/:id", authenticateIfPresent, ctrl.getOne);

// Restricted writes: only admin + transportation manager (dManager)
const CAN_WRITE: Role[] = ["admin", "tManager","csManager"];

router.post("/", authenticate, authorize(...CAN_WRITE), ctrl.create);
 router.patch("/:id", authenticate, authorize(...CAN_WRITE), ctrl.update);
router.delete("/:id", authenticate, authorize(...CAN_WRITE), ctrl.remove);

export default router;
