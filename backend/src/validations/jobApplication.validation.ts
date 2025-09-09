// validations/jobApplication.validation.ts
import { body, param, query } from "express-validator";
import {
  jobApplicationRoles,
  jobApplicationStatuses,
} from "../utils/constants";

/** ---------- Helpers ---------- */

const isNonEmptyTrimmed = (v: any) =>
  typeof v === "string" && v.trim().length > 0;

const sanitizeLimit = (n: any) => {
  const x = Number(n);
  if (Number.isNaN(x) || x <= 0) return 20;
  return Math.min(Math.trunc(x), 100); // cap at 100
};

const sanitizePage = (n: any) => {
  const x = Number(n);
  if (Number.isNaN(x) || x <= 0) return 1;
  return Math.trunc(x);
};

const WEEKLY_LEN = 7;
const validateWeeklySchedule = (arr: unknown) => {
  if (arr == null) return true; // optional
  if (!Array.isArray(arr) || arr.length !== WEEKLY_LEN) return false;
  return arr.every(
    (n) =>
      Number.isInteger(n) &&
      n >= 0
      // If you want to enforce 4 shifts/day (0..15), uncomment below:
      // && n <= 15
  );
};

const allowedDelivererKeys = new Set([
  "licenseType",
  "driverLicenseNumber",
  "vehicleMake",
  "vehicleModel",
  "vehicleType",
  "vehicleYear",
  "vehicleRegistrationNumber",
  "vehicleInsurance",
  "vehicleCapacityKg",
  "vehicleCapacityLiters",
  "speedKmH",
  "payFixedPerShift",
  "payPerKm",
  "payPerStop",
  "weeklySchedule",
]);

const allowedIndustrialExtra = new Set(["refrigerated"]);

const allowedFarmerLandKeys = new Set([
  "name",
  "ownership",
  "acres",
  "pickupAddress",
]);

const validateDelivererData = (data: any, isIndustrial: boolean) => {
  if (data == null || typeof data !== "object" || Array.isArray(data))
    return "applicationData must be an object";

  // Disallow unknown keys (strict)
  for (const k of Object.keys(data)) {
    if (!allowedDelivererKeys.has(k) && !(isIndustrial && allowedIndustrialExtra.has(k))) {
      return `Unknown field in applicationData: ${k}`;
    }
  }

  if (!isNonEmptyTrimmed(data.licenseType))
    return "licenseType is required";
  if (!isNonEmptyTrimmed(data.driverLicenseNumber))
    return "driverLicenseNumber is required";

  if (data.vehicleYear != null && (!Number.isInteger(data.vehicleYear) || data.vehicleYear < 1900 || data.vehicleYear > 3000))
    return "vehicleYear must be an integer between 1900 and 3000";

  for (const numField of [
    "vehicleCapacityKg",
    "vehicleCapacityLiters",
    "speedKmH",
    "payFixedPerShift",
    "payPerKm",
    "payPerStop",
  ]) {
    if (data[numField] != null && (typeof data[numField] !== "number" || data[numField] < 0)) {
      return `${numField} must be a non-negative number`;
    }
  }

  if (!validateWeeklySchedule(data.weeklySchedule)) {
    return "weeklySchedule must be an array of exactly 7 non-negative integers";
  }

  if (!isIndustrial && "refrigerated" in data) {
    return "refrigerated is only allowed for industrialDeliverer";
  }
  if (isIndustrial && data.refrigerated != null && typeof data.refrigerated !== "boolean") {
    return "refrigerated must be a boolean";
  }

  return true;
};

const validateFarmerData = (data: any) => {
  if (data == null || typeof data !== "object" || Array.isArray(data))
    return "applicationData must be an object";

  if (!isNonEmptyTrimmed(data.farmName))
    return "farmName is required";

  if (data.agriculturalInsurance != null && typeof data.agriculturalInsurance !== "boolean")
    return "agriculturalInsurance must be a boolean";

  if (data.agreementPercentage != null) {
    if (typeof data.agreementPercentage !== "number" || data.agreementPercentage < 0 || data.agreementPercentage > 100) {
      return "agreementPercentage must be a number between 0 and 100";
    }
  }

  if (!Array.isArray(data.lands))
    return "lands must be an array";

  for (let i = 0; i < data.lands.length; i++) {
    const land = data.lands[i];
    if (land == null || typeof land !== "object" || Array.isArray(land))
      return `lands[${i}] must be an object`;

    // Disallow unknown keys (strict)
    for (const k of Object.keys(land)) {
      if (!allowedFarmerLandKeys.has(k)) {
        return `Unknown field in lands[${i}]: ${k}`;
      }
    }

    if (!isNonEmptyTrimmed(land.name))
      return `lands[${i}].name is required`;

    if (!["owned", "rented"].includes(land.ownership))
      return `lands[${i}].ownership must be "owned" or "rented"`;

    if (typeof land.acres !== "number" || land.acres < 0)
      return `lands[${i}].acres must be a non-negative number`;

    const addr = land.pickupAddress;
    if (!addr || typeof addr !== "object" || Array.isArray(addr))
      return `lands[${i}].pickupAddress must be an object`;

    if (!isNonEmptyTrimmed(addr.address))
      return `lands[${i}].pickupAddress.address is required`;

    if (addr.latitude != null && (typeof addr.latitude !== "number" || addr.latitude < -90 || addr.latitude > 90))
      return `lands[${i}].pickupAddress.latitude must be between -90 and 90`;

    if (addr.longitude != null && (typeof addr.longitude !== "number" || addr.longitude < -180 || addr.longitude > 180))
      return `lands[${i}].pickupAddress.longitude must be between -180 and 180`;
  }

  return true;
};

const validateMinimalWorkerData = (data: any) => {
  if (data == null) return true; // allow empty / undefined
  if (typeof data !== "object" || Array.isArray(data))
    return "applicationData must be an object";
  // currently empty object schema; no extra keys enforcement for future extensibility
  return true;
};

const perRoleApplicationDataValidator = () =>
  body("applicationData")
    .custom((value, { req }) => {
      const role = req.body?.appliedRole;
      switch (role) {
        case "deliverer": {
          const ok = validateDelivererData(value, false);
          if (ok !== true) throw new Error(ok);
          return true;
        }
        case "industrialDeliverer": {
          const ok = validateDelivererData(value, true);
          if (ok !== true) throw new Error(ok);
          return true;
        }
        case "farmer": {
          const ok = validateFarmerData(value);
          if (ok !== true) throw new Error(ok);
          return true;
        }
        case "picker":
        case "sorter": {
          const ok = validateMinimalWorkerData(value);
          if (ok !== true) throw new Error(ok);
          return true;
        }
        default:
          // If role missing/invalid, let the other validators handle it.
          return true;
      }
    });

/** ---------- Validators ---------- */

// POST /job-applications
export const create = [
  body("appliedRole")
    .exists().withMessage("appliedRole is required")
    .isIn(jobApplicationRoles).withMessage("Invalid appliedRole"),
  body("logisticCenterId")
  .optional({ values: "null" })
  .matches(/^[A-Za-z0-9-]+$/)
  .withMessage("logisticCenterId must be alphanumeric and may include dashes"),
  perRoleApplicationDataValidator(),
];

// GET /job-applications/mine
export const mineQuery = [
  query("role")
    .optional()
    .isIn(jobApplicationRoles).withMessage("Invalid role filter"),
  query("status")
    .optional()
    .isIn(jobApplicationStatuses).withMessage("Invalid status filter"),
  query("page")
    .optional()
    .customSanitizer(sanitizePage)
    .isInt({ min: 1 }).withMessage("page must be a positive integer"),
  query("limit")
    .optional()
    .customSanitizer(sanitizeLimit)
    .isInt({ min: 1, max: 100 }).withMessage("limit must be 1..100"),
  query("sort")
    .optional()
    .isIn(["-createdAt", "createdAt", "-updatedAt", "updatedAt"])
    .withMessage("Invalid sort"),
];

// GET /job-applications (admin/staff)
export const listQuery = [
  query("role")
    .optional()
    .isIn(jobApplicationRoles).withMessage("Invalid role filter"),
  query("status")
    .optional()
    .isIn(jobApplicationStatuses).withMessage("Invalid status filter"),
  query("logisticCenterId")
   .optional()
   .matches(/^[A-Za-z0-9-]+$/)
   .withMessage("logisticCenterId must be alphanumeric and may include dashes"),
  query("user")
    .optional()
    .isMongoId().withMessage("user must be a valid id"),
  query("from")
    .optional()
    .isISO8601().withMessage("from must be an ISO8601 date"),
  query("to")
    .optional()
    .isISO8601().withMessage("to must be an ISO8601 date"),
  query("page")
    .optional()
    .customSanitizer(sanitizePage)
    .isInt({ min: 1 }).withMessage("page must be a positive integer"),
  query("limit")
    .optional()
    .customSanitizer(sanitizeLimit)
    .isInt({ min: 1, max: 100 }).withMessage("limit must be 1..100"),
  query("sort")
    .optional()
    .isIn([
      "-createdAt",
      "createdAt",
      "-updatedAt",
      "updatedAt",
      "-status",
      "status",
    ])
    .withMessage("Invalid sort"),
];

// :id param
export const idParam = [
  param("id").isMongoId().withMessage("Invalid id parameter"),
];

// PATCH /job-applications/:id (owner edit)
export const patchApplication = [
  ...idParam,
  // Only allow applicationData
  body().custom((bodyObj) => {
    const keys = Object.keys(bodyObj || {});
    const allowed = new Set(["applicationData"]);
    for (const k of keys) {
      if (!allowed.has(k)) {
        throw new Error(`Only 'applicationData' can be updated`);
      }
    }
    return true;
  }),
  perRoleApplicationDataValidator(),
];

// PATCH /job-applications/:id/status (admin/staff)
export const patchStatus = [
  ...idParam,
  body("status")
    .exists().withMessage("status is required")
    .isIn(jobApplicationStatuses).withMessage("Invalid status"),
  body("note")
    .optional()
    .isString().withMessage("note must be a string")
    .isLength({ max: 2000 }).withMessage("note must be ≤ 2000 chars"),
];

// PATCH /job-applications/:id/meta (admin/staff)
export const patchMeta = [
  ...idParam,
  body("logisticCenterId")
    .optional({ values: "null" })
    .matches(/^[A-Za-z0-9-]+$/)
    .withMessage("logisticCenterId must be alphanumeric and may include dashes"),
];

export default {
  create,
  mineQuery,
  listQuery,
  idParam,
  patchApplication,
  patchStatus,
  patchMeta,
};
