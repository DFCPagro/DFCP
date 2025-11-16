// src/data/roles.ts
export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "checkbox"
  | "dimensions"
  | "select";



type ColSpan = { base?: number; md?: number; lg?: number };

export type SelectOption = {
  label: string;
  value: string;
};


export type RoleField = {
  label: string;
  /** optional stable key; if omitted, derived from label */
  name?: string;
  type: FieldType;
  /** used as section id/name */
  step?: string;
  /** per-field help hint */
  help?: string;
  /** responsive width of this field in the grid */
  colSpan?: ColSpan;

  // native input props
  min?: string | number;
  max?: string | number;
  pattern?: string;
  stepAttr?: string; // numeric step attribute for <input type="number">

  /** dimensions-only options */
  unit?: "cm" | "m" | "in";
  /** select-only options */
  options?: SelectOption[]; // ← NEW
};

// We keep StepMeta but use it as section meta (title/help/order)
export type StepMeta = {
  id: string;
  title?: string;
  help?: string;
  order?: number;
};

export type RoleDef = {
  name: string;
  description: string;
  includeSchedule: boolean;
  includeLand: boolean;
  fields: RoleField[];
  stepsMeta?: StepMeta[]; // acts as section metadata
};
export const VEHICLE_TYPE_OPTIONS: SelectOption[] = [
  { label: "Bicycle", value: "bicycle" },
  { label: "Motorbike / Scooter", value: "motorbike" },
  { label: "Small Car", value: "small_car" },
  { label: "Family Car / Sedan", value: "sedan" },
  { label: "SUV / Crossover", value: "suv" },
  { label: "Van", value: "van" },
  { label: "Refrigerated Van", value: "refrigerated_van" },
  { label: "Pickup Truck", value: "pickup" },
  { label: "Light Truck (up to 3.5t)", value: "truck_3_5t" },
  { label: "Medium Truck (up to 7.5t)", value: "truck_7_5t" },
  { label: "Heavy / Semi Trailer", value: "heavy_truck" },
];

export const RolesTable: readonly RoleDef[] = [
  {
     name: "deliverer",
    description: "Responsible for transporting shipments.",
    includeSchedule: true,
    includeLand: false,
    stepsMeta: [
      { id: "vehicle", title: "Vehicle", help: "Tell us about your vehicle.", order: 1 },
      { id: "driver", title: "Driver", help: "Your credentials.", order: 2 },
      { id: "compliance", title: "Compliance", order: 3 },
    ],
    fields: [
      // Vehicle
      { label: "Vehicle Make",   name: "vehicleMake",  type: "text",   step: "vehicle" },
      { label: "Vehicle Model",  name: "vehicleModel", type: "text",   step: "vehicle" },

      // ↓ changed to dropdown
      {
        label: "Vehicle Type",
        name: "vehicleType",
        type: "select",
        step: "vehicle",
        options: VEHICLE_TYPE_OPTIONS,
        help: "Choose the main vehicle you will use for deliveries.",
      },

      { label: "Vehicle Year",   name: "vehicleYear",  type: "number", step: "vehicle", colSpan: { md: 1 } },

      // Cargo dimensions
      {
        label: "Cargo dimensions",
        name: "vehicleCargoCM",
        type: "dimensions",
        step: "vehicle",
        unit: "cm",
        help: "Internal cargo box size.",
        colSpan: { base: 1, md: 2 },
      },

      // line 1 (full width)
      {
        label: "Vehicle Capacity (L)",
        name: "vehicleCapacityLiters",
        type: "number",
        step: "vehicle",
        stepAttr: "0.1",
        min: "0",
        colSpan: { base: 1, md: 2 },
      },

      // line 2 (two columns side-by-side)
      {
        label: "Vehicle Weight Capacity",
        name: "vehicleCapacityValue",
        type: "number",
        step: "vehicle",
        stepAttr: "0.1",
        min: "0",
      },
      {
        label: "Weight Unit",
        name: "vehicleCapacityUnit",
        type: "text",
        step: "vehicle",
        help: "Choose kg or t",
      },

      // hidden computed (still hidden)
      {
        label: "Capacity (kg, computed)",
        name: "vehicleCapacityKg",
        type: "number",
        step: "vehicle",
        colSpan: { base: 0 },
      },

      // Driver
      { label: "License Type",           name: "licenseType",          type: "text", step: "driver" },
      { label: "Driver License Number",  name: "licenseNumber",        type: "text", step: "driver" },

      // Compliance
      {
        label: "Vehicle Registration Number",
        name: "vehicleRegistrationNumber",
        type: "text",
        pattern: "[0-9]+",
        step: "compliance",
      },
      {
        label: "Vehicle Insurance",
        name: "vehicleInsurance",
        type: "checkbox",
        step: "compliance",
      },
    ],
  },

  {
    name: "industrialDeliverer",
    description: "Delivers goods from farms to the logistics center.",
    includeSchedule: true,
    includeLand: false,
    stepsMeta: [
      { id: "vehicle", title: "Vehicle", order: 1 },
      { id: "driver", title: "Driver", order: 2 },
      { id: "features", title: "Features", order: 3 },
      { id: "compliance", title: "Compliance", order: 4 },
    ],
    fields: [
      { label: "Vehicle Make",  name: "vehicleMake",  type: "text", step: "vehicle" },
      { label: "Vehicle Model", name: "vehicleModel", type: "text", step: "vehicle" },

      // same dropdown list reused here
      {
        label: "Vehicle Type",
        name: "vehicleType",
        type: "select",
        step: "vehicle",
        options: VEHICLE_TYPE_OPTIONS,
      },

      { label: "Vehicle Year",  name: "vehicleYear", type: "number", step: "vehicle" },

      // Cargo dimensions
      {
        label: "Cargo dimensions",
        name: "vehicleCargoCM",
        type: "dimensions",
        step: "vehicle",
        unit: "cm",
        help: "Internal cargo box size.",
        colSpan: { base: 1, md: 2 },
      },

      // line 1 (full width)
      {
        label: "Vehicle Capacity (L)",
        name: "vehicleCapacityLiters",
        type: "number",
        step: "vehicle",
        stepAttr: "0.1",
        min: "0",
        colSpan: { base: 1, md: 2 },
      },

      // line 2 (two columns side-by-side)
      {
        label: "Vehicle Weight Capacity",
        name: "vehicleCapacityValue",
        type: "number",
        step: "vehicle",
        stepAttr: "0.1",
        min: "0",
      },
      {
        label: "Weight Unit",
        name: "vehicleCapacityUnit",
        type: "text",
        step: "vehicle",
        help: "Choose kg or t",
      },

      // hidden computed (still hidden)
      {
        label: "Capacity (kg, computed)",
        name: "vehicleCapacityKg",
        type: "number",
        step: "vehicle",
        colSpan: { base: 0 },
      },

      { label: "License Type",          name: "licenseType",   type: "text", step: "driver" },
      { label: "Driver License Number", name: "licenseNumber", type: "text", step: "driver" },

      { label: "Refrigerated", name: "refrigerated", type: "checkbox", step: "features" },

      {
        label: "Vehicle Registration Number",
        name: "vehicleRegistrationNumber",
        type: "text",
        pattern: "[0-9]+",
        step: "compliance",
      },
      {
        label: "Vehicle Insurance",
        name: "vehicleInsurance",
        type: "checkbox",
        step: "compliance",
      },
    ],
  },


  {
    name: "farmer",
    description: "Supplies produce and quality reports.",
    includeSchedule: false,   // farmer never uses weekly schedule
    includeLand: true,        // farmer requires lands array
    stepsMeta: [
      { id: "farm", title: "Farm", help: "Basic farm details.", order: 1 },
      { id: "compliance", title: "Compliance", order: 2 },
      // no lands here — handled by LandList UI
    ],
    fields: [
      { label: "Farm Name", name: "farmName", type: "text", step: "farm" },
      {
        label: "Agricultural Insurance",
        name: "agriculturalInsurance",
        type: "checkbox",
        step: "compliance",
      },
      {
        label: "Agreement Percentage",
        name: "agreementPercentage",
        type: "number",
        step: "compliance",
        min: 0,
        max: 100,
        // hide from UI but include in payload with default value
        colSpan: { base: 0 },
      },
    ],
  },

  {
    name: "picker",
    description: "Packages and labels containers before shipping.",
    includeSchedule: false,
    includeLand: false,
    fields: [{ label: "Years of Experience", type: "text", step: "basics" }],
    stepsMeta: [{ id: "basics", title: "Basics" }],
  },

  { name: "warehouse-worker", description: "Operates heavy-duty vehicles and equipment.", includeSchedule: false, includeLand: false, fields: [] },

  { name: "sorting", description: "General worker in the logistics center, sorting employee.", includeSchedule: false, includeLand: false, fields: [] },
] as const;
