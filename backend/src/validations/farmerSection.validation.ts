// src/validations/farmerSection.validation.ts
import { body, param, query } from "express-validator";

/* -------------------------------------------------------
 * Helpers
 * ----------------------------------------------------- */
const isYYYYMMDD = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Treat "" as null so the service can store nulls cleanly */
const emptyStringToNull = (v: unknown) => (v === "" ? null : v);

/** Allow null or plain object (non-array) */
const isNullablePlainObject = (v: unknown) => {
  if (v === null) return true;
  return typeof v === "object" && !Array.isArray(v);
};

/** Require that at least one of the provided fields is present */
export const atLeastOne =
  (fields: string[]) =>
  (value: any, { req }: any) => {
    const hasAny = fields.some((f) => req.body[f] !== undefined);
    if (!hasAny) {
      throw new Error(`Provide at least one of: ${fields.join(", ")}`);
    }
    return true;
  };

/* -------------------------------------------------------
 * GET /api/v1/farmer/lands
 * (no params needed, export empty array for consistency)
 * ----------------------------------------------------- */
export const listLandsRules = [];

/* -------------------------------------------------------
 * GET /api/v1/farmer/sections?landId=LAND_ID
 * ----------------------------------------------------- */
export const listSectionsRules = [
  query("landId")
    .exists({ checkFalsy: true })
    .withMessage("landId is required")
    .bail()
    .isMongoId()
    .withMessage("landId must be a valid id"),
];

/* -------------------------------------------------------
 * POST /api/v1/farmer/lands/:landId/sections
 * Body: { name?, areaM2?, measurements? }
 * ----------------------------------------------------- */
export const createSectionRules = [
  param("landId").isMongoId().withMessage("landId must be a valid id"),

  body("name")
    .optional({ nullable: true })
    .customSanitizer(emptyStringToNull)
    .isString()
    .withMessage("name must be a string")
    .bail()
    .isLength({ max: 120 })
    .withMessage("name must be at most 120 characters"),

  body("areaM2")
    .optional({ nullable: true })
    .toFloat()
    .isFloat({ min: 0 })
    .withMessage("areaM2 must be a number >= 0"),

  body("measurements")
    .optional({ nullable: true })
    .customSanitizer(emptyStringToNull)
    .custom(isNullablePlainObject)
    .withMessage("measurements must be an object or null"),
];

/* -------------------------------------------------------
 * POST /api/v1/farmer/sections/:sectionId/crops
 * Body: {
 *   itemId, plantedAmountGrams,
 *   avgRatePerUnit?, expectedFruitingPerPlant?,
 *   plantedOnDate?, expectedHarvestDate?
 * }
 * ----------------------------------------------------- */
export const addCropRules = [
  param("sectionId").isMongoId().withMessage("sectionId must be a valid id"),

  body("itemId")
    .exists({ checkFalsy: true })
    .withMessage("itemId is required")
    .bail()
    .isMongoId()
    .withMessage("itemId must be a valid id"),

  body("plantedAmountGrams")
    .exists({ checkFalsy: true })
    .withMessage("plantedAmountGrams is required")
    .bail()
    .toFloat()
    .isFloat({ gt: 0 })
    .withMessage("plantedAmountGrams must be a number > 0"),

  body("avgRatePerUnit")
    .optional({ nullable: true })
    .toFloat()
    .isFloat({ min: 0 })
    .withMessage("avgRatePerUnit must be a number >= 0"),

  body("expectedFruitingPerPlant")
    .optional({ nullable: true })
    .toFloat()
    .isFloat({ min: 0 })
    .withMessage("expectedFruitingPerPlant must be a number >= 0"),

  body("plantedOnDate")
    .optional({ nullable: true })
    .customSanitizer(emptyStringToNull)
    .custom((v) => v === null || isYYYYMMDD(v))
    .withMessage('plantedOnDate must be "YYYY-MM-DD" or null'),

  body("expectedHarvestDate")
    .optional({ nullable: true })
    .customSanitizer(emptyStringToNull)
    .custom((v) => v === null || isYYYYMMDD(v))
    .withMessage('expectedHarvestDate must be "YYYY-MM-DD" or null'),
];

/* -------------------------------------------------------
 * PATCH /api/v1/farmer/sections/:sectionId
 * Body: { name?, areaM2?, measurements? } (at least one)
 * ----------------------------------------------------- */
export const updateSectionRules = [
  param("sectionId").isMongoId().withMessage("sectionId must be a valid id"),

  // Require one of the editable fields
  body().custom(atLeastOne(["name", "areaM2", "measurements"])),

  body("name")
    .optional({ nullable: true })
    .customSanitizer(emptyStringToNull)
    .isString()
    .withMessage("name must be a string")
    .bail()
    .isLength({ max: 120 })
    .withMessage("name must be at most 120 characters"),

  body("areaM2")
    .optional({ nullable: true })
    .toFloat()
    .isFloat({ min: 0 })
    .withMessage("areaM2 must be a number >= 0"),

  body("measurements")
    .optional({ nullable: true })
    .customSanitizer(emptyStringToNull)
    .custom(isNullablePlainObject)
    .withMessage("measurements must be an object or null"),
];

/* -------------------------------------------------------
 * DELETE /api/v1/farmer/sections/:sectionId
 * ----------------------------------------------------- */
export const deleteSectionRules = [
  param("sectionId").isMongoId().withMessage("sectionId must be a valid id"),
];
