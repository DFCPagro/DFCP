// validations/jobApplication.validation.ts
import { body, param, query } from "express-validator";
import {
  jobApplicationRoles,
  jobApplicationStatuses,
} from "../utils/constants";

/* ----------------------------- Helpers ----------------------------- */

const MAX_LIMIT = 100; // local cap

const OPTIONAL_TRIMMED_STRING = (field: string, min = 1, max = 200) =>
  body(field)
    .optional({ nullable: true })
    .isString().withMessage(`${field} must be a string`)
    .bail()
    .trim()
    .isLength({ min, max })
    .withMessage(`${field} must be between ${min} and ${max} characters`);

/**
 * Accepts "createdAt", "updatedAt", "status", "appliedRole"
 * Optional leading "-" for desc.
 */
const SORT_FIELD_WHITELIST = ["createdAt", "updatedAt", "status", "appliedRole"] as const;
const sortQueryValidation = query("sort")
  .optional({ nullable: true })
  .isString().withMessage("sort must be a string")
  .bail()
  .trim()
  .custom((val: string) => {
    const field = val.startsWith("-") ? val.slice(1) : val;
    return (SORT_FIELD_WHITELIST as readonly string[]).includes(field);
  })
  .withMessage(
    `sort must be one of: ${SORT_FIELD_WHITELIST.join(", ")} (prefix with "-" for descending)`
  );

/* ------------------------- Reusable validators ------------------------- */

/** For routes with /:id */
export const idParamValidation = [
  param("id")
    .isMongoId()
    .withMessage("Invalid id format (must be a Mongo ObjectId)"),
];

/* --------------------------- Create (public) --------------------------- */
/**
 * POST /api/job-applications
 * Minimal applicant payload:
 *  - appliedRole: required, enum
 *  - applicationData: required object (free-form by role)
 *  - logisticCenterId: optional ObjectId (nullable)
 *  - notes/contactEmail/contactPhone: optional (light guards)
 *  - status: must NOT be provided by applicant
 */
export const createJobApplicationValidation = [
  body("appliedRole")
    .exists({ checkFalsy: true })
    .withMessage("appliedRole is required")
    .bail()
    .isIn(jobApplicationRoles as unknown as string[])
    .withMessage(`appliedRole must be one of: ${jobApplicationRoles.join(", ")}`),

  body("applicationData")
    .exists()
    .withMessage("applicationData is required")
    .bail()
    .isObject()
    .withMessage("applicationData must be an object"),

  body("logisticCenterId")
    .optional({ nullable: true })
    .isMongoId()
    .withMessage("logisticCenterId must be a valid ObjectId"),

  OPTIONAL_TRIMMED_STRING("notes", 1, 1000),

  body("contactEmail")
    .optional({ nullable: true })
    .isString().withMessage("contactEmail must be a string")
    .bail()
    .trim()
    .isEmail()
    .withMessage("contactEmail must be a valid email"),

  body("contactPhone")
    .optional({ nullable: true })
    .isString().withMessage("contactPhone must be a string")
    .bail()
    .trim()
    .isLength({ min: 6, max: 30 })
    .withMessage("contactPhone must be between 6 and 30 characters"),

  body("status").not().exists().withMessage("status cannot be set by applicant"),
];

/* ----------------------------- Admin list ----------------------------- */
/**
 * GET /api/admin/job-applications
 * Admin-only listing with filters & pagination
 */
export const adminListJobApplicationsValidation = [
  query("page")
    .optional({ nullable: true })
    .isInt({ min: 1 })
    .withMessage("page must be an integer ≥ 1"),

  query("limit")
    .optional({ nullable: true })
    .isInt({ min: 1, max: MAX_LIMIT })
    .withMessage(`limit must be an integer between 1 and ${MAX_LIMIT}`),

  query("role")
    .optional({ nullable: true })
    .isIn(jobApplicationRoles as unknown as string[])
    .withMessage(`role must be one of: ${jobApplicationRoles.join(", ")}`),

  query("status")
    .optional({ nullable: true })
    .isIn(jobApplicationStatuses as unknown as string[])
    .withMessage(`status must be one of: ${jobApplicationStatuses.join(", ")}`),

  query("user")
    .optional({ nullable: true })
    .isMongoId()
    .withMessage("user must be a valid ObjectId"),

  query("logisticCenterId")
    .optional({ nullable: true })
    .isMongoId()
    .withMessage("logisticCenterId must be a valid ObjectId"),

  query("from")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("from must be a valid ISO date"),

  query("to")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("to must be a valid ISO date"),

  sortQueryValidation,
];

/* ------------------------- Admin status update ------------------------ */
/**
 * PATCH /api/admin/job-applications/:id/status
 * Admin-only status changes.
 * (Transition validity is enforced in service)
 */
export const adminStatusUpdateValidation = [
  ...idParamValidation,

  body("status")
    .exists({ checkFalsy: true })
    .withMessage("status is required")
    .bail()
    .isIn(jobApplicationStatuses as unknown as string[])
    .withMessage(`status must be one of: ${jobApplicationStatuses.join(", ")}`),

  OPTIONAL_TRIMMED_STRING("reviewerNotes", 1, 2000),

  body("contactedAt")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("contactedAt must be a valid ISO date"),
  body("approvedAt")
    .optional({ nullable: true })
    .isISO8601()
    .withMessage("approvedAt must be a valid ISO date"),
];

/* --------------------------- Admin edit fields ------------------------ */
/**
 * PATCH /api/admin/job-applications/:id
 * Non-status field edits by admins (e.g., correcting contact info, role, center).
 */
export const adminUpdateJobApplicationValidation = [
  ...idParamValidation,

  OPTIONAL_TRIMMED_STRING("notes", 1, 1000),

  body("contactEmail")
    .optional({ nullable: true })
    .isString().withMessage("contactEmail must be a string")
    .bail()
    .trim()
    .isEmail()
    .withMessage("contactEmail must be a valid email"),

  body("contactPhone")
    .optional({ nullable: true })
    .isString().withMessage("contactPhone must be a string")
    .bail()
    .trim()
    .isLength({ min: 6, max: 30 })
    .withMessage("contactPhone must be between 6 and 30 characters"),

  body("appliedRole")
    .optional({ nullable: true })
    .isIn(jobApplicationRoles as unknown as string[])
    .withMessage(`appliedRole must be one of: ${jobApplicationRoles.join(", ")}`),

  body("logisticCenterId")
    .optional({ nullable: true })
    .isMongoId()
    .withMessage("logisticCenterId must be a valid ObjectId"),

  // Prevent accidental status change via this route
  body("status").not().exists().withMessage("Use /:id/status to change status"),
];
