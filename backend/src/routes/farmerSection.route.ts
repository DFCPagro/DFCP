// src/routes/farmerSection.route.ts
import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth";
import validate from "../utils/validate";
import * as ctrl from "../controllers/farmerSection.controller";
import * as vs from "../validations/farmerSection.validation";

const router = Router();

/**
 * Farmer Sections & Crops
 * Access: farmers only (ownership enforced in service)
 */

// Lands (left pane)
router.get(
  "/farmer/lands",
  authenticate,
  authorize("farmer"), // adjust if your authorize signature differs
  vs.listLandsRules,
  validate,
  ctrl.getLands,
);

// Sections for a land (with embedded crops)
router.get(
  "/farmer/sections",
  authenticate,
  authorize("farmer"),
  vs.listSectionsRules,
  validate,
  ctrl.getSections,
);

// Create a new section under a land
router.post(
  "/farmer/lands/:landId/sections",
  authenticate,
  authorize("farmer"),
  vs.createSectionRules,
  validate,
  ctrl.createSection,
);

// Add a crop to a section
router.post(
  "/farmer/sections/:sectionId/crops",
  authenticate,
  authorize("farmer"),
  vs.addCropRules,
  validate,
  ctrl.addCrop,
);

// Update a section
router.patch(
  "/farmer/sections/:sectionId",
  authenticate,
  authorize("farmer"),
  vs.updateSectionRules,
  validate,
  ctrl.updateSection,
);

// Delete a section (and its embedded crops)
router.delete(
  "/farmer/sections/:sectionId",
  authenticate,
  authorize("farmer"),
  vs.deleteSectionRules,
  validate,
  ctrl.deleteSection,
);

export default router;
