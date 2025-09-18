import { z } from "zod";
import type { RoleDef, RoleField } from "@/data/roles";

const numberLike = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Number(v)), "Must be a number")
  .transform((v) => (v === "" ? undefined : Number(v)));

const nonNegative = numberLike.refine(
  (v) => v === undefined || v >= 0,
  "Must be ≥ 0"
);

const stringOrEmail = (type: RoleField["type"]) =>
  type === "email"
    ? z.string().trim().email("Invalid email")
    : z.string().trim().min(1, "Required");

const scalarFor = (f: RoleField) => {
  // Coerce numeric inputs to numbers (works whether UI passes string or number)
  if (f.type === "number") {
    // special-case: agreementPercentage must be 0..100 (and can be hidden)
    if ((f.name ?? toCamelCase(f.label)) === "agreementPercentage") {
      return z.coerce.number().min(0, "Min 0").max(100, "Max 100").optional();
    }
    return z.coerce.number().min(0, "Must be ≥ 0").optional();
  }

  switch (f.type) {
    case "text":
    case "email":
    case "tel":
      return stringOrEmail(f.type);
    case "checkbox":
      return z.boolean();
    case "dimensions":
      return z.object({
        length: z.coerce.number().min(0, "Must be ≥ 0"),
        width:  z.coerce.number().min(0, "Must be ≥ 0"),
        height: z.coerce.number().min(0, "Must be ≥ 0"),
        unit: z.enum(["cm", "m", "in"]).optional(),
      });
    default:
      return z.any();
  }
};


function toCamelCase(label: string) {
  return label
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .split(/\s+/)
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()
    )
    .join("");
}

const AddressSchema = z.object({
  alt: z.coerce.number(), // latitude
  lnt: z.coerce.number(), // longitude
  address: z.string().trim().min(1, "Address is required"),
});

const MeasurementsSchema = z.object({
  abM: z.coerce.number().min(0, "Must be ≥ 0"),
  bcM: z.coerce.number().min(0, "Must be ≥ 0"),
  cdM: z.coerce.number().min(0, "Must be ≥ 0"),
  daM: z.coerce.number().min(0, "Must be ≥ 0"),
  rotationDeg: z.coerce.number().min(-360).max(360).optional().default(0),
});

const FarmerLandSchema = z.object({
  name: z.string().min(1, "Land name is required"),
  ownership: z.enum(["owned", "rented"]),
  address: AddressSchema,
  pickupAddress: AddressSchema.nullable().optional(),
  measurements: MeasurementsSchema,
});


export function buildSchema(role: RoleDef) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of role.fields) {
    const name = f.name ?? toCamelCase(f.label);
    shape[name] = scalarFor(f);
  }

  // Role-conditional extras
  const extras: Record<string, z.ZodTypeAny> = {};

  if (role.includeSchedule) {
    // 7 integers, 0..15 bitmask per day
    extras.weeklySchedule = z
      .array(z.number().int().min(0).max(15))
      .length(7, "Weekly schedule must have 7 days");
  }

  if (role.includeLand) {
    // At least one land, each with address + measurements
    extras.lands = z.array(FarmerLandSchema).min(1, "Add at least one land");
  }

  return z.object({
    ...shape,
    ...extras,
  });
}


export function extractErrors(result: z.SafeParseReturnType<any, any>) {
  if (result.success) return {};
  const map: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "";
    if (key && !map[key]) map[key] = issue.message;
  }
  return map;
}

