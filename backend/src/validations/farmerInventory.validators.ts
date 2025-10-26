// src/validations/farmerInventory.validation.ts
import { body, param, query, oneOf } from "express-validator";

/**
 * Common helpers
 */
const nonEmptyString = (field: string) =>
  body(field)
    .isString()
    .withMessage(`${field} must be a string`)
    .bail()
    .notEmpty()
    .withMessage(`${field} is required`)
    .bail()
    .trim();

const optionalNonEmptyString = (field: string) =>
  body(field)
    .optional({ nullable: true })
    .isString()
    .withMessage(`${field} must be a string`)
    .bail()
    .notEmpty()
    .withMessage(`${field} cannot be empty if provided`)
    .bail()
    .trim();

const optionalNonNegativeNumber = (field: string) =>
  body(field)
    .optional()
    .isFloat({ min: 0 })
    .withMessage(`${field} must be a number >= 0`)
    .toFloat();

/**
 * GET /farmer/inventory
 * Query filters: farmerId?, itemId?, logisticCenterId?
 * Optional pagination: page?, limit? (kept optional and light)
 */
export const listInventoryRules = [
  query("farmerId")
    .optional()
    .isString()
    .withMessage("farmerId must be a string")
    .bail()
    .notEmpty()
    .withMessage("farmerId cannot be empty")
    .trim(),
  query("itemId")
    .optional()
    .isString()
    .withMessage("itemId must be a string")
    .bail()
    .notEmpty()
    .withMessage("itemId cannot be empty")
    .trim(),
  query("logisticCenterId")
    .optional()
    .isString()
    .withMessage("logisticCenterId must be a string")
    .bail()
    .notEmpty()
    .withMessage("logisticCenterId cannot be empty")
    .trim(),
  // keep pagination optional; harmless if unused
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be an integer >= 1")
    .toInt(),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be an integer between 1 and 100")
    .toInt(),
];

/**
 * GET /farmer/inventory/:id
 */
export const getInventoryByIdRules = [
  param("id")
    .isString()
    .withMessage("id must be a string")
    .bail()
    .notEmpty()
    .withMessage("id is required")
    .trim(),
];

/**
 * POST /farmer/inventory
 * Body: { farmerId, itemId, logisticCenterId?, agreementAmountKg?, currentAvailableAmountKg? }
 */
export const createInventoryRules = [
  nonEmptyString("farmerId"),
  nonEmptyString("itemId"),
  optionalNonEmptyString("logisticCenterId"),
  optionalNonNegativeNumber("agreementAmountKg"),
  optionalNonNegativeNumber("currentAvailableAmountKg"),

  // Cross-field rule: if both amounts are present, available must not exceed agreement
  body().custom((_, { req }) => {
    const a = req.body?.agreementAmountKg;
    const c = req.body?.currentAvailableAmountKg;
    if (a !== undefined && c !== undefined && c > a) {
      throw new Error(
        "currentAvailableAmountKg cannot be greater than agreementAmountKg"
      );
    }
    return true;
  }),
];

/**
 * PATCH /farmer/inventory/:id
 * Body: subset of { agreementAmountKg, currentAvailableAmountKg, logisticCenterId? }
 */
export const patchInventoryRules = [
  param("id")
    .isString()
    .withMessage("id must be a string")
    .bail()
    .notEmpty()
    .withMessage("id is required")
    .trim(),

  // Must include at least one updatable field
  oneOf(
    [
      body("agreementAmountKg").exists(),
      body("currentAvailableAmountKg").exists(),
      body("logisticCenterId").exists(),
    ],
    {
      message:
        "Provide at least one of: agreementAmountKg, currentAvailableAmountKg, logisticCenterId",
    }
  ),

  optionalNonNegativeNumber("agreementAmountKg"),
  optionalNonNegativeNumber("currentAvailableAmountKg"),
  optionalNonEmptyString("logisticCenterId"),

  // Cross-field rule: if both amounts present, enforce available <= agreement
  body().custom((_, { req }) => {
    const a = req.body?.agreementAmountKg;
    const c = req.body?.currentAvailableAmountKg;
    if (a !== undefined && c !== undefined && c > a) {
      throw new Error(
        "currentAvailableAmountKg cannot be greater than agreementAmountKg"
      );
    }
    return true;
  }),
];
