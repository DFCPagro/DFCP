// src/types/farmers.ts
import { z } from "zod";

/* ----------------------------- Shared helpers ----------------------------- */
const IsoDateLike = z.union([z.string(), z.date()]);

// Common id aliases (strings to match ObjectId-like values)
export type FarmerId = string;
export type FarmerLandId = string;
export type FarmerSectionId = string;
export type ItemId = string;
export type UserId = string;
export type LogisticCenterId = string;

/* --------------------------------- Enums ---------------------------------- */
// Prefer to tolerate both "rented" and "leased" to avoid BE drift.
export const LandOwnershipEnum = z.union([
  z.literal("owned"),
  z.literal("rented"),
  z.literal("leased"),
]);
export type LandOwnership = z.infer<typeof LandOwnershipEnum>;

export const CropStatusEnum = z
  .enum(["planting", "growing", "readyForHarvest", "clearing", "problem"])
  .catch("planting");
export type CropStatus = z.infer<typeof CropStatusEnum>;

/* ------------------------------ Measurements ------------------------------ */
export const MeasurementsSchema = z.object({
  // Use coerce to accept "12.3" as well as 12.3
  abM: z.coerce.number().nonnegative().min(0),
  bcM: z.coerce.number().nonnegative().min(0),
  cdM: z.coerce.number().nonnegative().min(0),
  daM: z.coerce.number().nonnegative().min(0),
  rotationDeg: z.coerce.number().min(-360).max(360),
});
export type Measurements = z.infer<typeof MeasurementsSchema>;

/* ------------------------------- Address type ----------------------------- */
export const AddressSchema = z.object({
  address: z.string().optional(),
  lnt: z.coerce.number().optional(), // longitude
  alt: z.coerce.number().optional(), // latitude
  logisticCenterId: z.string().optional().nullable(),
});
export type Address = z.infer<typeof AddressSchema>;

/* --------------------------------- Crops ---------------------------------- */
export const SectionCropSchema = z.object({
  item: z.string().min(1), // ItemId from /items/public
  status: CropStatusEnum.optional(),

  plantedAmount: z.coerce.number().min(0).optional(),
  plantedOnDate: IsoDateLike.optional(),
  avgRatePerUnit: z.coerce.number().min(0).optional(),

  expectedFruitingPerPlant: z.coerce.number().min(0).optional(),
  expectedHarvestDate: IsoDateLike.optional(),
  statusPercentage: z.coerce.number().min(0).max(100).optional(),
  expectedHarvestKg: z.coerce.number().min(0).optional(),

  meta: z.record(z.any()).optional(),
});
export type SectionCrop = z.infer<typeof SectionCropSchema>;

/* -------------------------------- Sections -------------------------------- */
export const FarmerSectionSchema = z.object({
  _id: z.string().min(1), // required for fetched DTOs
  land: z.string().min(1), // matches your BE: "land" (not landId)

  name: z.string().optional().nullable(),
  areaM2: z.coerce.number().nonnegative().optional().nullable(),
  logisticCenterId: z.string().optional().nullable(),

  crops: z.array(SectionCropSchema).optional().nullable(),
  measurements: MeasurementsSchema.optional(), // be lenient for missing data

  matrix: z.array(z.unknown()).optional(),

  // remaining amount farmer can still supply (kg)
  agreementAmountKg: z.coerce.number().min(0).optional(),

  createdAt: IsoDateLike.optional(),
  updatedAt: IsoDateLike.optional(),
});
export type FarmerSection = z.infer<typeof FarmerSectionSchema>;

/* ---------------------------------- Lands --------------------------------- */
export const FarmerLandBaseSchema = z.object({
  _id: z.string().min(1), // required for list/detail usage
  farmer: z.string().min(1), // matches your BE: "farmer"
  name: z.string().min(1),
  ownership: LandOwnershipEnum, // strict; see enum above
  areaM2: z.coerce.number().nonnegative().optional().nullable(),

  address: AddressSchema.optional().nullable(),
  pickupAddress: AddressSchema.optional().nullable(),
  measurements: MeasurementsSchema.optional(), // lenient

  // If BE sometimes returns ids here
  sections: z.array(z.string().min(1)).optional(),

  createdAt: IsoDateLike.optional(),
  updatedAt: IsoDateLike.optional(),
});
export type FarmerLandBase = z.infer<typeof FarmerLandBaseSchema>;

// Land without embedded sections
export const FarmerLandLiteSchema = FarmerLandBaseSchema.extend({
  sections: z.undefined().optional(), // explicit: BE didn’t populate
});
export type FarmerLandLite = z.infer<typeof FarmerLandLiteSchema>;

// Land with embedded sections
export const FarmerLandDetailSchema = FarmerLandBaseSchema.extend({
  sections: z.array(FarmerSectionSchema).optional().nullable(),
});
export type FarmerLandDetail = z.infer<typeof FarmerLandDetailSchema>;

/* --------------------------------- Farmer --------------------------------- */
export const FarmerDetailSchema = z.object({
  _id: z.string().min(1), // required for fetched DTOs
  user: z.string().min(1), // UserId

  farmName: z.string().min(1),
  farmLogo: z.string().url().optional().nullable(),
  agriculturalInsurance: z.boolean().default(true),
  farmerBio: z.string().min(1).optional(),
  agreementPercentage: z.coerce.number().min(0).max(100).optional(),

  lands: z
    .array(z.union([FarmerLandLiteSchema, FarmerLandDetailSchema]))
    .optional()
    .nullable(),

  createdAt: IsoDateLike,
  updatedAt: IsoDateLike.optional(),
});
export type FarmerDetail = z.infer<typeof FarmerDetailSchema>;

/* ----------------------------- List / Responses --------------------------- */
// If your list is thin, you could define a smaller schema; extending works too.
export const FarmerListItemSchema = FarmerDetailSchema.extend({
  landsCount: z.coerce.number().int().min(0).optional(),
  sectionsCount: z.coerce.number().int().min(0).optional(),
  joinedAt: IsoDateLike.optional(), // optional duplication of createdAt
});
export type FarmerListItem = z.infer<typeof FarmerListItemSchema>;

export const FarmerListResponseSchema = z.object({
  items: z.array(FarmerListItemSchema),
  page: z.coerce.number().int().min(1),
  limit: z.coerce.number().int().min(1),
  total: z.coerce.number().int().min(0),
  pages: z.coerce.number().int().min(0),
});
export type FarmerListResponse = z.infer<typeof FarmerListResponseSchema>;

export const FarmerDetailResponseSchema = z.object({
  farmer: FarmerDetailSchema,
});
export type FarmerDetailResponse = z.infer<typeof FarmerDetailResponseSchema>;

/* -------------------------- Narrowing / Type guards ----------------------- */
export function isLandDetail(
  land:
    | z.infer<typeof FarmerLandLiteSchema>
    | z.infer<typeof FarmerLandDetailSchema>
): land is z.infer<typeof FarmerLandDetailSchema> {
  return (
    Array.isArray((land as any).sections) || (land as any).sections === null
  );
}
