// validations/shiftConfig.validation.ts
import { query, body } from "express-validator";

const SHIFT_NAMES = ["morning", "afternoon", "evening", "night"] as const;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const windowsQuery = [
  query("lc").exists().withMessage("lc is required").bail().isString().trim().notEmpty(),
  query("name").exists().withMessage("name is required").bail().isString().trim()
    .isIn(SHIFT_NAMES as unknown as string[]),
];

export const listAllQuery = [
  query("lc").exists().withMessage("lc is required").bail().isString().trim().notEmpty(),
];

/** PATCH body validators: accept HH:mm *or* *_Min numbers */
export const windowsPatch = [
  query("lc").exists().withMessage("lc is required").bail().isString().trim().notEmpty(),
  query("name").exists().withMessage("name is required").bail().isString().trim()
    .isIn(SHIFT_NAMES as unknown as string[]),

  body("generalStartMin").optional().isInt({ min: 0, max: 1439 }),
  body("generalEndMin").optional().isInt({ min: 0, max: 1439 }),

  // industrialDeliverer
  body("industrialDelivererStart").optional().matches(HHMM),
  body("industrialDelivererEnd").optional().matches(HHMM),
  body("industrialDelivererStartMin").optional().isInt({ min: 0, max: 1439 }),
  body("industrialDelivererEndMin").optional().isInt({ min: 0, max: 1439 }),

  // deliverer
  body("delivererStart").optional().matches(HHMM),
  body("delivererEnd").optional().matches(HHMM),
  body("delivererStartMin").optional().isInt({ min: 0, max: 1439 }),
  body("delivererEndMin").optional().isInt({ min: 0, max: 1439 }),

  // delivery slot
  body("deliveryTimeSlotStart").optional().matches(HHMM),
  body("deliveryTimeSlotEnd").optional().matches(HHMM),
  body("deliveryTimeSlotStartMin").optional().isInt({ min: 0, max: 1439 }),
  body("deliveryTimeSlotEndMin").optional().isInt({ min: 0, max: 1439 }),

  // misc
  body("slotSizeMin").optional().isInt({ min: 5, max: 240 }),
  body("timezone").optional().isString().trim().notEmpty(),
];

export { SHIFT_NAMES };
