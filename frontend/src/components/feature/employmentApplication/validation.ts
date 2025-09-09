// src/components/feature/employmentApplication/validation.ts
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
  switch (f.type) {
    case "text":
    case "email":
    case "tel":
      return stringOrEmail(f.type);
    case "number":
      return nonNegative;
    case "checkbox":
      return z.boolean();
    case "dimensions":
      return z
        .object({
          length: nonNegative.optional(),
          width: nonNegative.optional(),
          height: nonNegative.optional(),
          unit: z.enum(["cm", "m", "in"]).optional(),
        })
        .refine(
          (v) =>
            v.length !== undefined &&
            v.width !== undefined &&
            v.height !== undefined,
          { message: "Enter length, width, and height" }
        );
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

export function buildSchema(role: RoleDef) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of role.fields) {
    const name = f.name ?? toCamelCase(f.label);
    shape[name] = scalarFor(f);
  }
  return z.object({
    ...shape,
    scheduleBitmask: z.array(z.number()).optional(),
    lands: z
      .array(
        z.object({
          id: z.string().optional(),
          name: z.string().min(1, "Land name is required"),
          area: z.number().nonnegative("Area must be ≥ 0").optional(),
        })
      )
      .optional(),
  });
}

export function extractErrors(result: z.SafeParseReturnType<any, any>) {
  if (result.success) return {};
  const map: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key) map[key] = issue.message;
  }
  return map;
}
