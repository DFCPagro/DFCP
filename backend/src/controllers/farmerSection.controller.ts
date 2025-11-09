// src/controllers/farmerSection.controller.ts
import { Request, Response, NextFunction } from "express";
import ApiError from "../utils/ApiError";
import {
  listLandsForFarmer,
  listSectionsByLand,
  createSection as svcCreateSection,
  addCropToSection as svcAddCropToSection,
  updateSection as svcUpdateSection,
  deleteSection as svcDeleteSection,
} from "../services/farmerSection.service";

/* ────────────────────────────────────────────────────────────────────────── *
 * Utilities
 * ────────────────────────────────────────────────────────────────────────── */

function getReqUserId(req: Request): string {
  const anyReq = req as any;
  const id = anyReq?.user?.id ?? anyReq?.user?._id;
  if (!id) throw new ApiError(401, "Unauthorized");
  return String(id);
}

/* ────────────────────────────────────────────────────────────────────────── *
 * NEW: FE-aligned handlers (plural / wrapper responses)
 * Mount these under /api/v1/farmers/...
 * ────────────────────────────────────────────────────────────────────────── */

/** GET /api/v1/farmers/lands  →  { items: LandDTO[] } */
export async function getFarmerLandsFE(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getReqUserId(req);
    const items = await listLandsForFarmer(userId);
    res.status(200).json({ items });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/farmers/sections?landId=...  →  { items: SectionDTO[] } */
export async function getFarmerSectionsByLandFE(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getReqUserId(req);
    const landId = String(req.query.landId ?? "");
    if (!landId) throw new ApiError(400, "landId is required");
    const items = await listSectionsByLand(userId, landId);
    res.status(200).json({ items });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/farmers/lands/:landId/sections  →  SectionDTO */
export async function createSectionFE(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getReqUserId(req);
    const { landId } = req.params;
    const section = await svcCreateSection(userId, landId, req.body);
    res.status(201).json(section);
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/farmers/sections/:sectionId/crops  →  SectionCropDTO */
export async function addCropFE(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getReqUserId(req);
    const { sectionId } = req.params;
    const crop = await svcAddCropToSection(userId, sectionId, req.body);
    res.status(201).json(crop);
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/v1/farmers/sections/:sectionId  →  SectionDTO */
export async function updateSectionFE(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getReqUserId(req);
    const { sectionId } = req.params;
    const updated = await svcUpdateSection(userId, sectionId, req.body);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/farmers/sections/:sectionId  →  204 */
export async function deleteSectionFE(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getReqUserId(req);
    const { sectionId } = req.params;
    await svcDeleteSection(userId, sectionId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/* ────────────────────────────────────────────────────────────────────────── *
 * LEGACY HANDLERS (keep behavior AS-IS, mounted under /api/v1/farmer/...)
 * TODO: migrate callers to the FE-aligned versions above, then remove.
 * ────────────────────────────────────────────────────────────────────────── */

/** GET /api/v1/farmer/lands  →  LandDTO[]  (legacy shape, no wrapper) */
export async function getLands(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getReqUserId(req);
    const lands = await listLandsForFarmer(userId);
    res.status(200).json(lands);
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/farmer/sections?landId=...  →  SectionDTO[]  (legacy) */
export async function getSections(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getReqUserId(req);
    const landId = String(req.query.landId);
    const sections = await listSectionsByLand(userId, landId);
    res.status(200).json(sections);
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/farmer/lands/:landId/sections  →  SectionDTO  (legacy) */
export async function createSection(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getReqUserId(req);
    const { landId } = req.params;
    const section = await svcCreateSection(userId, landId, req.body);
    res.status(201).json(section);
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/farmer/sections/:sectionId/crops  →  SectionCropDTO  (legacy) */
export async function addCrop(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getReqUserId(req);
    const { sectionId } = req.params;
    const crop = await svcAddCropToSection(userId, sectionId, req.body);
    res.status(201).json(crop);
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/v1/farmer/sections/:sectionId  →  SectionDTO  (legacy) */
export async function updateSection(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getReqUserId(req);
    const { sectionId } = req.params;
    const updated = await svcUpdateSection(userId, sectionId, req.body);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/farmer/sections/:sectionId  →  204  (legacy) */
export async function deleteSection(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getReqUserId(req);
    const { sectionId } = req.params;
    await svcDeleteSection(userId, sectionId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
