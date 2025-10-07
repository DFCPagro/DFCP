export const roles = ['customer', 'farmer', 'picker', 'sorter', 'deliverer','industrialDeliverer', 'tManager', 'fManager', 'opManager', 'admin'] as const;
export type Role = typeof roles[number];

/** ---------------------------
 *  Job Application – Roles
 *  --------------------------- */
export const jobApplicationRoles = [
  "deliverer",
  "industrialDeliverer",
  "farmer",
  "picker",
  "sorter",
] as const;
export type JobApplicationRole = typeof jobApplicationRoles[number];

export const jobApplicationStatuses = [
  "pending",
  "contacted",
  "approved",
  "denied",
] as const;
export type JobApplicationStatus = typeof jobApplicationStatuses[number];


/** Valid status transitions (enforced by controllers/services) */
export const JOB_APP_ALLOWED_TRANSITIONS: Readonly<
  Record<JobApplicationStatus, readonly JobApplicationStatus[]>
> = Object.freeze({
  pending: ["contacted", "denied"],
  contacted: ["approved", "denied"],
  approved: [], // terminal
  denied: [],   // terminal
});

export const JOB_APP_TERMINAL_STATUSES = ["approved", "denied"] as const;







/** 
 * 
 * Tokens Related
 */

export const QR_SCOPES = [
  "farmer-order",
  "farmer-container",
  "farmer-delivery",
  "order-package",
  "order",
] as const;

export type QrScope = (typeof QR_SCOPES)[number];