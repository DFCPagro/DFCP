export const roles = ['customer', 'farmer', 'deliverer','industrialDeliverer', 'dManager', 'fManager', 'opManager', 'admin'] as const;
export type Role = typeof roles[number];

// utils/constants.ts
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
