// controllers/farmer.controller.ts
import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { getFarmerBioByUserId } from "../services/farmer.service"; // <— fix name
import ApiError from "../utils/ApiError";

export async function getFarmerBio(req: Request, res: Response, next: NextFunction) {
  try {
    const { farmerUserId } = req.params;

    if (!farmerUserId) throw new ApiError(400, "userId param is required");
    if (!Types.ObjectId.isValid(farmerUserId)) throw new ApiError(400, "Invalid userId");

    const data = await getFarmerBioByUserId(farmerUserId);
    if (!data) throw new ApiError(404, "Farmer not found for this userId");

    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}
