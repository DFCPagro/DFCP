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
 *
 * NEW (FE-aligned): mounted under /api/v1/farmers/...
 * LEGACY (kept for compatibility): mounted under /api/v1/farmer/...
 */

/* ────────────────────────────────────────────────────────────────────────── *
 * NEW: FE-aligned endpoints (plural + wrapper responses)
 * ────────────────────────────────────────────────────────────────────────── */

// Lands (left pane) -> { items: LandDTO[] }
router.get(
  "/farmers/lands",
  authenticate,
  authorize("farmer"),
  vs.listLandsRules,
  validate,
  ctrl.getFarmerLandsFE
);

// Sections for a land (with embedded crops) -> { items: SectionDTO[] }
router.get(
  "/farmers/sections",
  authenticate,
  authorize("farmer"),
  vs.listSectionsRules,
  validate,
  ctrl.getFarmerSectionsByLandFE
);

// Create a new section under a land -> SectionDTO
router.post(
  "/farmers/lands/:landId/sections",
  authenticate,
  authorize("farmer"),
  vs.createSectionRules,
  validate,
  ctrl.createSectionFE
);

// Add a crop to a section -> SectionCropDTO
router.post(
  "/farmers/sections/:sectionId/crops",
  authenticate,
  authorize("farmer"),
  vs.addCropRules,
  validate,
  ctrl.addCropFE
);

// Update a section -> SectionDTO
router.patch(
  "/farmers/sections/:sectionId",
  authenticate,
  authorize("farmer"),
  vs.updateSectionRules,
  validate,
  ctrl.updateSectionFE
);

// Delete a section (and its embedded crops) -> 204
router.delete(
  "/farmers/sections/:sectionId",
  authenticate,
  authorize("farmer"),
  vs.deleteSectionRules,
  validate,
  ctrl.deleteSectionFE
);

/* ────────────────────────────────────────────────────────────────────────── *
 * LEGACY: keep existing endpoints AS-IS (no wrappers)
 * TODO: migrate callers to the FE-aligned versions above, then remove.
 * ────────────────────────────────────────────────────────────────────────── */

// Lands (left pane) -> LandDTO[]
router.get(
  "/farmer/lands",
  authenticate,
  authorize("farmer"),
  vs.listLandsRules,
  validate,
  ctrl.getLands
);

// Sections for a land (with embedded crops) -> SectionDTO[]
router.get(
  "/farmer/sections",
  authenticate,
  authorize("farmer"),
  vs.listSectionsRules,
  validate,
  ctrl.getSections
);

// Create a new section under a land -> SectionDTO
router.post(
  "/farmer/lands/:landId/sections",
  authenticate,
  authorize("farmer"),
  vs.createSectionRules,
  validate,
  ctrl.createSection
);

// Add a crop to a section -> SectionCropDTO
router.post(
  "/farmer/sections/:sectionId/crops",
  authenticate,
  authorize("farmer"),
  vs.addCropRules,
  validate,
  ctrl.addCrop
);

// Update a section -> SectionDTO
router.patch(
  "/farmer/sections/:sectionId",
  authenticate,
  authorize("farmer"),
  vs.updateSectionRules,
  validate,
  ctrl.updateSection
);

// Delete a section -> 204
router.delete(
  "/farmer/sections/:sectionId",
  authenticate,
  authorize("farmer"),
  vs.deleteSectionRules,
  validate,
  ctrl.deleteSection
);

export default router;
