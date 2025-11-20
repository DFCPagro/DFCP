import { Router } from "express";
import * as ctrl from "../controllers/packageSize.controller";
import { authenticate, authenticateIfPresent, authorize } from "../middlewares/auth";
import { Role } from "../utils/constants";

const router = Router();
const CAN_WRITE: Role[] = ["admin", "tManager"];

/* ---------- CONTAINERS (must be before "/:idOrKey") ---------- */

router.get("/containers", authenticateIfPresent, ctrl.listContainers);
router.get("/containers/:idOrKey", authenticateIfPresent, ctrl.getOneContainer);

router.post(
  "/containers",
  authenticate,
  authorize(...CAN_WRITE),
  ctrl.createContainer
);
router.patch(
  "/containers/:idOrKey",
  authenticate,
  authorize(...CAN_WRITE),
  ctrl.updateContainer
);
router.delete(
  "/containers/:idOrKey",
  authenticate,
  authorize(...CAN_WRITE),
  ctrl.removeContainer
);

/* ---------- PACKAGE SIZES ---------- */

router.get("/", authenticateIfPresent, ctrl.list);
router.get("/:idOrKey", authenticateIfPresent, ctrl.getOne);

router.post("/", authenticate, authorize(...CAN_WRITE), ctrl.create);
router.patch("/:idOrKey", authenticate, authorize(...CAN_WRITE), ctrl.update);
router.delete("/:idOrKey", authenticate, authorize(...CAN_WRITE), ctrl.remove);

export default router;
