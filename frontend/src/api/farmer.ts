// src/api/farmer.ts
// Real API calls (no fakes). Parses responses with Zod to keep FE stable.
//
// Endpoints assumed:
//   GET  /farmers                      -> list (filtered server-side by token/LC)
//   GET  /farmers/:id                  -> detail (lands may or may not be populated)
//   GET  /farmer-lands?farmerId=:id    -> (optional) lands if detail is shallow
//   GET  /farmer-sections?landId=:id   -> (optional) sections if lands are shallow
//
// If your BE differs, adjust the paths or response wrappers below.

import { api } from "./config";
import { z } from "zod";
import {
  FarmerListResponseSchema,
  FarmerDetailResponseSchema,
  FarmerLandDetailSchema,
  FarmerLandLiteSchema,
  FarmerSectionSchema,
  type FarmerListResponse,
  type FarmerDetailResponse,
  type FarmerId,
  type FarmerLandId,
} from "@/types/farmer";

/* ----------------------------------------------------------------------------
 * Query Keys (for React Query v5 hooks to reuse)
 * ------------------------------------------------------------------------- */

export type ListFarmersParams = {
  search?: string;
  sort?: string; // e.g., "-createdAt" or "farmName"
  page?: number | string; // allow both to compose from URLSearchParams
  limit?: number | string;
};

export const qkFarmersList = (p: ListFarmersParams = {}) =>
  [
    "farmers",
    "list",
    p.search ?? "",
    p.sort ?? "-createdAt",
    String(p.page ?? 1),
    String(p.limit ?? 20),
  ] as const;

export const qkFarmerById = (id: FarmerId) => ["farmers", "byId", id] as const;
export const qkFarmerLandsByFarmer = (farmerId: FarmerId) =>
  ["farmerLands", "byFarmer", farmerId] as const;
export const qkFarmerSectionsByLand = (landId: FarmerLandId) =>
  ["farmerSections", "byLand", landId] as const;

/* ----------------------------------------------------------------------------
 * Helpers (local to this module; no shared utils)
 * ------------------------------------------------------------------------- */

function cleanParams<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== "") {
      // normalize page/limit if passed as string
      // leave other strings as-is
      // @ts-ignore index OK
      out[k] =
        (k === "page" || k === "limit") && typeof v === "string"
          ? (Number(v) as any)
          : (v as any);
    }
  }
  return out;
}

// Local response wrappers for optional endpoints
const FarmerLandsResponseSchema = z.object({
  items: z.array(z.union([FarmerLandLiteSchema, FarmerLandDetailSchema])),
});
type FarmerLandsResponse = z.infer<typeof FarmerLandsResponseSchema>;

const FarmerSectionsResponseSchema = z.object({
  items: z.array(FarmerSectionSchema),
});
type FarmerSectionsResponse = z.infer<typeof FarmerSectionsResponseSchema>;

/* ----------------------------------------------------------------------------
 * API: list + detail
 * ------------------------------------------------------------------------- */

/** GET /farmers */
export async function listFarmers(
  params: ListFarmersParams = {},
  opts?: { signal?: AbortSignal }
): Promise<FarmerListResponse> {
  const { signal } = opts ?? {};
  const res = await api.get("/farmers", {
    params: cleanParams(params),
    signal,
  });
  const parsed = FarmerListResponseSchema.safeParse(res.data);
  if (!parsed.success) {
    // surface the first issue to ease debugging
    const first = parsed.error.issues[0];
    throw new Error(
      `Invalid /farmers response: ${first?.path?.join(".") ?? ""} ${first?.message ?? ""}`
    );
  }
  return parsed.data;
}

/** GET /farmers/:id */
export async function getFarmerById(
  id: FarmerId,
  opts?: { signal?: AbortSignal }
): Promise<FarmerDetailResponse> {
  const { signal } = opts ?? {};
  const res = await api.get(`/farmers/${id}`, { signal });
  const parsed = FarmerDetailResponseSchema.safeParse(res.data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(
      `Invalid /farmers/${id} response: ${first?.path?.join(".") ?? ""} ${first?.message ?? ""}`
    );
  }
  return parsed.data;
}

/* ----------------------------------------------------------------------------
 * API: optional fan-out (only if BE does not populate in /farmers/:id)
 * ------------------------------------------------------------------------- */

/** GET /farmer-lands?farmerId=:id (optional helper) */
export async function getFarmerLands(
  farmerId: FarmerId,
  opts?: { signal?: AbortSignal }
): Promise<FarmerLandsResponse> {
  const { signal } = opts ?? {};
  const res = await api.get(`/farmer-lands`, {
    params: { farmerId },
    signal,
  });
  const parsed = FarmerLandsResponseSchema.safeParse(res.data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(
      `Invalid /farmer-lands response: ${first?.path?.join(".") ?? ""} ${first?.message ?? ""}`
    );
  }
  return parsed.data;
}

/** GET /farmer-sections?landId=:id (optional helper) */
export async function getSectionsByLand(
  landId: FarmerLandId,
  opts?: { signal?: AbortSignal }
): Promise<FarmerSectionsResponse> {
  const { signal } = opts ?? {};
  const res = await api.get(`/farmer-sections`, {
    params: { landId },
    signal,
  });
  const parsed = FarmerSectionsResponseSchema.safeParse(res.data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(
      `Invalid /farmer-sections response: ${first?.path?.join(".") ?? ""} ${first?.message ?? ""}`
    );
  }
  return parsed.data;
}
