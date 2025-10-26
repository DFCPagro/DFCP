// src/routes/farmerInventory.route.ts
import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth";
import validate from "../utils/validate";
import * as ctrl from "../controllers/farmerInventory.controller";
import * as vs from "../validations/farmerInventory.validators";

const router = Router();

/**
 * Farmer Inventory
 * Access: farmers only (ownership enforced in service via req.user and farmerId checks)
 *
 * Endpoints:
 * - GET    /farmer/inventory               → list with filters (farmerId?, itemId?, logisticCenterId?)
 * - GET    /farmer/inventory/:id           → fetch single document by id
 * - POST   /farmer/inventory               → create single record
 * - PATCH  /farmer/inventory/:id           → partial update (amount fields, optional logisticCenterId)
 */

// List (with optional filters)
router.get(
  "/farmer/inventory",
  authenticate,
  authorize("farmer", "fManager", "admin"),
  vs.listInventoryRules,
  validate,
  ctrl.listInventory
);

// Get single by id
router.get(
  "/farmer/inventory/:id",
  authenticate,
  authorize("farmer", "fManager", "admin"),
  vs.getInventoryByIdRules,
  validate,
  ctrl.getInventoryById
);

// Create single record
router.post(
  "/farmer/inventory",
  authenticate,
  authorize("farmer", "fManager", "admin"),
  vs.createInventoryRules,
  validate,
  ctrl.createInventory
);

// Patch (partial update) by id
router.patch(
  "/farmer/inventory/:id",
  authenticate,
  authorize("farmer", "fManager", "admin"),
  vs.patchInventoryRules,
  validate,
  ctrl.patchInventory
);

export default router;
