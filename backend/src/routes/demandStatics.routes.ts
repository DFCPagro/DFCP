import { Router } from "express";
import { authenticate, authorize, authenticateIfPresent } from "../middlewares/auth";
import {
  getSlots,
  getSlot,
  postSlot,
  putSlot,
  patchSlotItems,
  deleteSlot,
  importRaw,
  getSlotRaw,
} from "../controllers/demandStatics.controller";
import { Role } from "../utils/constants";

const MUTATION_ROLES = ["tManager", "fManager", "opManager", "admin"] as const satisfies Role[];

const router = Router();

// Public/optional-auth reads
router.get("/", authenticateIfPresent, getSlots);
router.get("/:slotKey", authenticateIfPresent, getSlot);
router.get("/:slotKey/raw", authenticateIfPresent, getSlotRaw);

// Protected mutations
router.post("/", authenticate, authorize(...MUTATION_ROLES), postSlot);
router.put("/", authenticate, authorize(...MUTATION_ROLES), putSlot);
router.patch("/:slotKey/items", authenticate, authorize(...MUTATION_ROLES), patchSlotItems);
router.delete("/:slotKey", authenticate, authorize(...MUTATION_ROLES), deleteSlot);

// Bulk import
router.post("/import", authenticate, authorize(...MUTATION_ROLES), importRaw);

export default router;
