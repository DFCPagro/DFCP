import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth";
import * as ctrl from "../controllers/shelf.controller";

const router = Router();

// Read shelf + live crowd score
router.get("/:id", authenticate, authorize("opManager", "picker", "sorter", "admin"), ctrl.getShelf);

router.post(
  "/refill",
  authenticate,
  authorize("opManager", "sorter", "admin"),
  ctrl.refillFromWarehouse
);

// Put a container into a slot
router.post("/:shelfMongoId/slots/place", authenticate, authorize("opManager", "sorter", "admin"), ctrl.placeContainer);

// Consume weight from a slot (picker action)
router.post("/:id/slots/:slotId/consume", authenticate, authorize("picker", "opManager", "admin"), ctrl.consumeFromSlot);

// Move container between slots/shelves
router.post("/move", authenticate, authorize("opManager", "sorter", "admin"), ctrl.moveContainer);

// Crowd info for a shelf
router.get("/:id/crowd", authenticate, authorize("opManager", "picker", "sorter", "admin"), ctrl.crowdInfo);

// Mark task start/end to affect crowding
router.post("/:id/crowd/start", authenticate, authorize("picker", "sorter", "opManager", "admin"), ctrl.markTaskStart);
router.post("/:id/crowd/end", authenticate, authorize("picker", "sorter", "opManager", "admin"), ctrl.markTaskEnd);

// Get a few non-crowded shelves for scheduling
router.get("/_suggest/non-crowded", authenticate, authorize("opManager", "admin"), ctrl.getNonCrowded);

router.post("/:id/slots/empty",
  authenticate,
  authorize("opManager","sorter","admin"),
  ctrl.emptySlot
);

export default router;
