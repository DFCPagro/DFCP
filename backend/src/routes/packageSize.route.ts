import { Router } from "express";
import * as ctrl from "../controllers/packageSize.controller";
import { authenticate, authenticateIfPresent, authorize } from "../middlewares/auth"; // adjust path
import { Role } from "../utils/constants";

const router = Router();

router.get("/", authenticateIfPresent, ctrl.list);
router.get("/:idOrKey", authenticateIfPresent, ctrl.getOne);

// Restricted writes: only admin + transportation manager (dManager)
const CAN_WRITE: Role[] = ["admin", "tManager"];

router.post("/", authenticate, authorize(...CAN_WRITE), ctrl.create);
router.patch("/:idOrKey", authenticate, authorize(...CAN_WRITE), ctrl.update);
router.delete("/:idOrKey", authenticate, authorize(...CAN_WRITE), ctrl.remove);


router.get("/containers", ctrl.listContainers);
router.get("/containers/:idOrKey", ctrl.getOneContainer);
router.post("/containers", ctrl.createContainer);
router.patch("/containers/:idOrKey", ctrl.updateContainer);
router.delete("/containers/:idOrKey", ctrl.removeContainer);






export default router;
