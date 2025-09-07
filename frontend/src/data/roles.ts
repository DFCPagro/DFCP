export type FieldType = "text" | "email" | "tel" | "number" | "checkbox";
export type RoleField = { label: string; type: FieldType; step?: string; min?: string; pattern?: string };

export type RoleDef = {
  name: string;
  description: string;
  includeSchedule: boolean;
  includeLand: boolean;
  fields: RoleField[];
};

export const RolesTable: readonly RoleDef[] = [
  {
    name: "deliverer",
    description: "Responsible for transporting shipments.",
    includeSchedule: true,
    includeLand: false,
    fields: [
      { label: "License Type", type: "text" },
      { label: "Vehicle Make", type: "text" },
      { label: "Vehicle Model", type: "text" },
      { label: "Vehicle Type", type: "text" },
      { label: "Vehicle Year", type: "number" },
      { label: "Vehicle Capacity (t)", type: "number", step: "0.1", min: "0" },
      { label: "Driver License Number", type: "text" },
      { label: "Vehicle Registration Number", type: "text", pattern: "[0-9]+" },
      { label: "Vehicle Insurance", type: "checkbox" },
    ],
  },
  {
    name: "industrialDriver",
    description: "Delivers goods from farms to the logistics center.",
    includeSchedule: true,
    includeLand: false,
    fields: [
      { label: "License Type", type: "text" },
      { label: "Vehicle Make", type: "text" },
      { label: "Vehicle Model", type: "text" },
      { label: "Vehicle Type", type: "text" },
      { label: "Vehicle Year", type: "number" },
      { label: "Vehicle Capacity (t)", type: "number", step: "0.1", min: "0" },
      { label: "Driver License Number", type: "text" },
      { label: "Vehicle Registration Number", type: "text", pattern: "[0-9]+" },
      { label: "Vehicle Insurance", type: "checkbox" },
      { label: "Refrigerated", type: "checkbox" },
    ],
  },
  {
    name: "farmer",
    description: "Supplies produce and quality reports.",
    includeSchedule: false,
    includeLand: true,
    fields: [
      { label: "Agricultural Insurance", type: "checkbox" },
      { label: "Farm Name", type: "text" },
    ],
  },
  {
    name: "picker",
    description: "Packages and labels containers before shipping.",
    includeSchedule: false, includeLand: false,
    fields: [{ label: "Years of Experience", type: "text" }],
  },
  { name: "warehouse-worker", description: "Operates heavy-duty vehicles and equipment.", includeSchedule: false, includeLand: false, fields: [] },
  { name: "sorting", description: "General worker in the logistics center, sorting employee.", includeSchedule: false, includeLand: false, fields: [] },
] as const;
