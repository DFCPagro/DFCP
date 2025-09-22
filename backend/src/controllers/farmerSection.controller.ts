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

/** Safely read the authenticated user's id from req.user */
function getReqUserId(req: Request): string {
  // Many codebases attach either id or _id; support both
  const anyReq = req as any;
  const id = anyReq?.user?.id ?? anyReq?.user?._id;
  if (!id) throw new ApiError(401, "Unauthorized");
  return String(id);
}

/** GET /api/v1/farmer/lands */
export async function getLands(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getReqUserId(req);
    const lands = await listLandsForFarmer(userId);
    res.status(200).json(lands);
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/farmer/sections?landId=... */
export async function getSections(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getReqUserId(req);
    const landId = String(req.query.landId);
    const sections = await listSectionsByLand(userId, landId);
    res.status(200).json(sections);
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/farmer/lands/:landId/sections */
export async function createSection(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getReqUserId(req);
    const { landId } = req.params;
    const section = await svcCreateSection(userId, landId, req.body);
    res.status(201).json(section);
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/farmer/sections/:sectionId/crops */
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

/** PATCH /api/v1/farmer/sections/:sectionId */
export async function updateSection(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getReqUserId(req);
    const { sectionId } = req.params;
    const updated = await svcUpdateSection(userId, sectionId, req.body);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/v1/farmer/sections/:sectionId */
export async function deleteSection(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getReqUserId(req);
    const { sectionId } = req.params;
    await svcDeleteSection(userId, sectionId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
