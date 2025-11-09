// src/services/farmerSection.service.ts
import mongoose, { Types } from "mongoose";
import ApiError from "../utils/ApiError";
import Farmer from "../models/farmer.model";
import FarmerLand from "../models/farmerLand.model";
import FarmerSection from "../models/farmerSection.model";
// If your items model/service uses a different path/name, adjust this import:
import Item from "../models/Item.model";

/* =========================================================
 * Types exposed to controllers (DTOs & Inputs)
 * ======================================================= */

export type SectionCropDTO = {
  itemId: string;
  plantedAmountGrams: number;
  avgRatePerUnit?: number | null;
  expectedFruitingPerPlant?: number | null;
  plantedOnDate: string | null; // "YYYY-MM-DD" or null
  expectedHarvestDate: string | null; // "YYYY-MM-DD" or null
  status: "planting" | "growing" | "readyForHarvest" | "clearing" | "problem";
  statusPercentage: number; // 0..100
};

export type SectionDTO = {
  id: string;
  landId: string;
  name?: string | null;
  areaM2: number;
  measurements?: Record<string, unknown> | null;
  updatedAt: string; // ISO
  crops: SectionCropDTO[];
};

export type LandDTO = {
  id: string;
  name: string;
  areaM2: number;
  sectionsCount: number;
  updatedAt: string; // ISO
};

/** Create section input */
export type CreateSectionInput = {
  name?: string | null;
  areaM2?: number | null;
  measurements?: Record<string, unknown> | null;
};

/** Add crop input (to a section) */
export type CreateCropInput = {
  itemId: string; // ObjectId string
  plantedAmountGrams: number;
  avgRatePerUnit?: number | null;
  expectedFruitingPerPlant?: number | null;
  plantedOnDate?: string | null; // "YYYY-MM-DD" or null
  expectedHarvestDate?: string | null; // "YYYY-MM-DD" or null
};

/** Update section input (partial) */
export type UpdateSectionPatch = Partial<Omit<CreateSectionInput, never>>;

/* =========================================================
 * Small utilities
 * ======================================================= */

/** Accepts null | "YYYY-MM-DD" | Date | string; returns "YYYY-MM-DD" | null */
function normalizeYYYYMMDD(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    // If it's already "YYYY-MM-DD", accept it
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    // Try to parse ISO or other string formats
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return ymd(d);
  }
  if (v instanceof Date) return ymd(v);
  return null;
}

/** Ensures that provided optional date is either null or "YYYY-MM-DD" */
function nullableYYYYMMDD(v: unknown): string | null {
  return normalizeYYYYMMDD(v);
}

function ymd(d: Date): string {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
/* =========================================================
 * Public Service API (exported)
 * ======================================================= */

/** Resolve the Farmer doc for a given user id */
export async function getFarmerFromUser(userId: string) {
  const farmer = await Farmer.findOne({ user: userId }).lean();
  if (!farmer) {
    throw new ApiError(404, "Farmer profile not found for this user");
  }
  return farmer; // lean object
}

/** List lands for the current farmer with sectionsCount */
export async function listLandsForFarmer(userId: string): Promise<LandDTO[]> {
  const farmer = await getFarmerFromUser(userId);

  // Fetch lands
  const lands = await FarmerLand.find({ farmer: farmer._id }).lean();

  if (!lands.length) return [];

  // Count sections per land (aggregation for fewer round-trips)
  const counts = await FarmerSection.aggregate<{
    _id: Types.ObjectId;
    count: number;
  }>([
    { $match: { land: { $in: lands.map((l) => l._id) } } },
    { $group: { _id: "$land", count: { $sum: 1 } } },
  ]);

  const byLandId = new Map<string, number>();
  for (const c of counts) byLandId.set(String(c._id), c.count);

  return lands.map((land: any) =>
    mapLandDocToDTO(land, byLandId.get(String(land._id)) ?? 0)
  );
}

/** List sections for a land (with embedded crops) — ownership enforced */
export async function listSectionsByLand(
  userId: string,
  landId: string
): Promise<SectionDTO[]> {
  const farmer = await getFarmerFromUser(userId);
  const land = await assertLandOwnership(farmer._id, landId);

  // Sections for land
  const sections = await FarmerSection.find({ land: land._id }).lean();

  return sections.map((s: any) => mapSectionDocToDTO(s));
}

/** Create a new section under a land — ownership enforced */
export async function createSection(
  userId: string,
  landId: string,
  input: CreateSectionInput
): Promise<SectionDTO> {
  const farmer = await getFarmerFromUser(userId);
  const land = await assertLandOwnership(farmer._id, landId);

  const now = new Date();
  const doc = await FarmerSection.create({
    land: land._id,
    name: (input?.name ?? null) || null,
    areaM2: typeof input?.areaM2 === "number" ? input.areaM2 : 0,
    measurements: input?.measurements ?? null,
    crops: [],
    updatedAt: now,
  });

  const created = await FarmerSection.findById(doc._id).lean();
  if (!created) {
    // extremely unlikely right after create
    throw new ApiError(500, "Failed to create section");
  }
  return mapSectionDocToDTO(created);
}

/** Add a crop subdocument to a section — ownership enforced */
export async function addCropToSection(
  userId: string,
  sectionId: string,
  input: CreateCropInput
): Promise<SectionCropDTO> {
  const farmer = await getFarmerFromUser(userId);
  const { section } = await assertSectionOwnership(farmer._id, sectionId);

  // Validate referenced item exists (store only itemId ref here)
  if (!mongoose.isValidObjectId(input.itemId)) {
    throw new ApiError(400, "Invalid itemId");
  }
  const item = await Item.findById(input.itemId).select("_id").lean();
  if (!item) {
    throw new ApiError(404, "Referenced item not found");
  }

  const cropSubdoc: any = {
    itemId: new Types.ObjectId(input.itemId),
    plantedAmountGrams: input.plantedAmountGrams,
    avgRatePerUnit: input?.avgRatePerUnit ?? null,
    expectedFruitingPerPlant: input?.expectedFruitingPerPlant ?? null,
    plantedOnDate: nullableYYYYMMDD(input?.plantedOnDate),
    expectedHarvestDate: nullableYYYYMMDD(input?.expectedHarvestDate),
    status: "planting",
    statusPercentage: 0,
  };

  const now = new Date();

  const updated = await FarmerSection.findOneAndUpdate(
    { _id: section._id },
    {
      $push: { crops: cropSubdoc },
      $set: { updatedAt: now },
    },
    { new: true, projection: { crops: 1 } }
  ).lean();

  if (!updated) {
    throw new ApiError(500, "Failed to insert crop");
  }

  // Return the inserted crop (last element)
  const last = updated.crops?.[updated.crops.length - 1];
  if (!last) {
    throw new ApiError(500, "Failed to load created crop");
  }
  return mapCropToDTO(last);
}

/** Update a section (name/areaM2/measurements) — ownership enforced */
export async function updateSection(
  userId: string,
  sectionId: string,
  patch: UpdateSectionPatch
): Promise<SectionDTO> {
  const farmer = await getFarmerFromUser(userId);
  await assertSectionOwnership(farmer._id, sectionId);

  const toSet: Record<string, unknown> = { updatedAt: new Date() };

  if ("name" in patch) toSet["name"] = patch.name ?? null;
  if ("areaM2" in patch)
    toSet["areaM2"] = typeof patch.areaM2 === "number" ? patch.areaM2 : 0;
  if ("measurements" in patch)
    toSet["measurements"] = patch.measurements ?? null;

  const updated = await FarmerSection.findOneAndUpdate(
    { _id: sectionId },
    { $set: toSet },
    { new: true }
  ).lean();

  if (!updated) throw new ApiError(404, "Section not found");

  return mapSectionDocToDTO(updated);
}

/** Delete a section (cascade its embedded crops) — ownership enforced */
export async function deleteSection(
  userId: string,
  sectionId: string
): Promise<void> {
  const farmer = await getFarmerFromUser(userId);
  await assertSectionOwnership(farmer._id, sectionId);

  const res = await FarmerSection.deleteOne({ _id: sectionId });
  if (!res.deletedCount) {
    throw new ApiError(404, "Section not found");
  }
}

/* =========================================================
 * Internal helpers
 * ======================================================= */

async function assertLandOwnership(
  farmerId: Types.ObjectId | string,
  landId: string
) {
  if (!mongoose.isValidObjectId(landId)) {
    throw new ApiError(400, "Invalid landId");
  }
  const land = await FarmerLand.findById(landId).lean();
  if (!land) throw new ApiError(404, "Land not found");

  if (String(land.farmer) !== String(farmerId)) {
    throw new ApiError(403, "You do not have access to this land");
  }
  return land;
}

async function assertSectionOwnership(
  farmerId: Types.ObjectId | string,
  sectionId: string
) {
  if (!mongoose.isValidObjectId(sectionId)) {
    throw new ApiError(400, "Invalid sectionId");
  }

  // Load section with its land id
  const section = await FarmerSection.findById(sectionId).lean();
  if (!section) throw new ApiError(404, "Section not found");

  const land = await FarmerLand.findById(section.land).lean();
  if (!land) throw new ApiError(404, "Parent land not found");

  if (String(land.farmer) !== String(farmerId)) {
    throw new ApiError(403, "You do not have access to this section");
  }
  return { section, land };
}

function mapLandDocToDTO(land: any, sectionsCount: number): LandDTO {
  return {
    id: String(land._id),
    name: land.name,
    areaM2: Number(land.areaM2 ?? 0),
    sectionsCount,
    updatedAt: land.updatedAt
      ? new Date(land.updatedAt).toISOString()
      : new Date().toISOString(),
  };
}

function mapSectionDocToDTO(section: any): SectionDTO {
  return {
    id: String(section._id),
    landId: String(section.land),
    name: section.name ?? null,
    areaM2: Number(section.areaM2 ?? 0),
    measurements: section.measurements ?? null,
    updatedAt: section.updatedAt
      ? new Date(section.updatedAt).toISOString()
      : new Date().toISOString(),
    crops: Array.isArray(section.crops) ? section.crops.map(mapCropToDTO) : [],
  };
}

function mapCropToDTO(crop: any): SectionCropDTO {
  // If your schema stores dates as Date objects, convert to "YYYY-MM-DD"
  const planted = crop?.plantedOnDate ?? null;
  const harvest = crop?.expectedHarvestDate ?? null;

  return {
    itemId: String(crop.itemId),
    plantedAmountGrams: Number(crop.plantedAmountGrams ?? 0),
    avgRatePerUnit: crop?.avgRatePerUnit ?? null,
    expectedFruitingPerPlant: crop?.expectedFruitingPerPlant ?? null,
    plantedOnDate: normalizeYYYYMMDD(planted),
    expectedHarvestDate: normalizeYYYYMMDD(harvest),
    status: crop?.status ?? "planting",
    statusPercentage: Number(crop?.statusPercentage ?? 0),
  };
}

/* =========================================================
 * LEGACY PLACEHOLDERS (do not remove now)
 * -------------------------------------------------------
 * If your current codebase contains Farmer/Land-affecting
 * functions inside the Section service (historical reasons),
 * move them down here UNCHANGED and export them exactly as
 * before. Add a comment like:
 *
 *   // TODO: move to farmerLand.service / farmer.service
 *
 * We’re intentionally NOT inventing signatures here to avoid
 * breaking your app. Keep the original names/params/returns.
 * ======================================================= */

/**=============================TODO============
 * Move to farmerLand.service.ts
 * 
 * listLandsForFarmer(userId)
 * assertLandOwnership(farmerId, landId) (ownership guard)
 * mapLandDocToDTO(land, sectionsCount)
 * 
 * 
 * Move to farmer.service.ts
 * 
 * getFarmerFromUser(userId) (farmer lookup by user)
 * 
 ==============================================*/
