// /src/api/farmerCrops.ts
// Public API facade for Farmer → Lands → Sections → Crops.
// - Defaults to FAKE implementation unless VITE_USE_FAKE_FARMER_API === "false"
// - Real mode uses fetch against VITE_API_BASE_URL (default: "/api/v1")
// - Includes inline query keys (kept in this file as requested)

import * as fake from "./fakes/farmerCrops.fake";

import type { CreateSectionInput } from "@/types/agri";
/* =========================
 * Env config
 * ======================= */

const USE_FAKE =
  typeof import.meta !== "undefined" &&
  import.meta.env &&
  import.meta.env.VITE_USE_FAKE_FARMER_API !== "false";

const API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE_URL) ||
  "/api/v1";

/* =========================
 * Query Keys (inline)
 * ======================= */

export const farmerCropsKeys = {
  lands: () => ["farmer", "lands"] as const,
  sections: (landId: string) => ["farmer", "sections", landId] as const,
  catalogCrops: () => ["catalog", "crops"] as const,
  // If you ever split crops per section into a dedicated endpoint:
  sectionCrops: (sectionId: string) => ["farmer", "section", "crops", sectionId] as const,
};

async function real_createSection(
  landId: string,
  payload: CreateSectionInput
) : Promise<SectionDTO> {
  return request<SectionDTO>(`/farmer/lands/${encodeURIComponent(landId)}/sections`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createSection(
  landId: string,
  payload: CreateSectionInput
): Promise<SectionDTO> {
  if (USE_FAKE) {
    // if your fake file doesn't import shared types, payload is structurally compatible
    // ts-expect-error allow structural typing against local fake type
    return fake.createSection(landId, payload as any);
  }
  return real_createSection(landId, payload);
}

/* =========================
 * Types (kept local; you can lift to /src/types/agri.ts later)
 * ======================= */

export type CropStatus =
  | "planting"
  | "growing"
  | "readyForHarvest"
  | "clearing"
  | "problem";

export interface CatalogItemDTO {
  id: string;
  name: string;
  imageUrl?: string | null;
}

export interface SectionCropDTO {
  itemId: string;
  cropName?: string; // optional denormalized label for UI
  plantedAmountGrams: number;
  plantedOnDate: string | null; // "YYYY-MM-DD"
  status: CropStatus;
  statusPercentage?: number | null; // 0..100
  avgRatePerUnit?: number | null;
  expectedFruitingPerPlant?: number | null;
  expectedHarvestDate?: string | null; // "YYYY-MM-DD"
  expectedHarvestKg?: number | null;
  imageUrl?: string | null;
}

export interface SectionDTO {
  id: string;
  landId: string;
  name?: string;
  areaM2: number;
  updatedAt: string; // ISO
  measurements?: Record<string, unknown>;
  crops: SectionCropDTO[]; // crops live on sections
}

export interface LandDTO {
  id: string;
  name: string;
  areaM2: number;
  sectionsCount: number;
  updatedAt: string; // ISO
}

export interface CreateCropInput {
  itemId: string;
  plantedAmountGrams: number;
  avgRatePerUnit?: number | null;
  expectedFruitingPerPlant?: number | null;
  plantedOnDate: string | null; // "YYYY-MM-DD"
  expectedHarvestDate: string | null; // "YYYY-MM-DD"
}

/* =========================
 * HTTP utilities (real mode)
 * ======================= */

function getAuthToken(): string | null {
  try {
    // Adjust to your auth storage scheme if needed
    const raw = localStorage.getItem("auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.token && typeof parsed.token === "string") return parsed.token;
    }
    const token = localStorage.getItem("token");
    return token || null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const token = getAuthToken();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init?.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, { ...init, headers });

  if (!res.ok) {
    let detail = "";
    try {
      const errJson = await res.json();
      detail = errJson?.message || errJson?.error || "";
    } catch {
      // ignore
    }
    const msg = `HTTP ${res.status} ${res.statusText}${detail ? ` - ${detail}` : ""}`;
    throw new Error(msg);
  }

  // 204
  if (res.status === 204) return undefined as unknown as T;

  const text = await res.text();
  if (!text) return undefined as unknown as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    // If server returns plain text, accept it if T=string
    return text as unknown as T;
  }
}

/* =========================
 * Real-mode implementations (adjust routes if your backend differs)
 * ======================= */

// Suggested endpoints; change to your actual routes as needed.
async function real_listLands(): Promise<LandDTO[]> {
  // e.g., GET /api/v1/farmer/lands
  return request<LandDTO[]>("/farmer/lands");
}

async function real_listSectionsByLand(landId: string): Promise<SectionDTO[]> {
  // e.g., GET /api/v1/farmer/sections?landId=...
  const q = new URLSearchParams({ landId });
  return request<SectionDTO[]>(`/farmer/sections?${q.toString()}`);
}

async function real_listCropCatalog(): Promise<CatalogItemDTO[]> {
  // e.g., GET /api/v1/catalog/items?type=crop
  const q = new URLSearchParams({ type: "crop" });
  return request<CatalogItemDTO[]>(`/catalog/items?${q.toString()}`);
}

async function real_createSectionCrop(
  sectionId: string,
  payload: CreateCropInput
): Promise<SectionCropDTO> {
  // e.g., POST /api/v1/farmer/sections/:sectionId/crops
  return request<SectionCropDTO>(`/farmer/sections/${encodeURIComponent(sectionId)}/crops`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* =========================
 * Public API facade (switchable)
 * ======================= */

export async function listLands(): Promise<LandDTO[]> {
  if (USE_FAKE) return fake.listLands();
  return real_listLands();
}

export async function listSectionsByLand(landId: string): Promise<SectionDTO[]> {
  if (USE_FAKE) return fake.listSectionsByLand(landId);
  return real_listSectionsByLand(landId);
}

export async function listCropCatalog(): Promise<CatalogItemDTO[]> {
  if (USE_FAKE) return fake.listCropCatalog();
  return real_listCropCatalog();
}

export async function createSectionCrop(
  sectionId: string,
  payload: CreateCropInput
): Promise<SectionCropDTO> {
  if (USE_FAKE) return fake.createSectionCrop(sectionId, payload);
  return real_createSectionCrop(sectionId, payload);
}

/* =========================
 * Default export (convenience)
 * ======================= */

const farmerCropsApi = {
  listLands,
  listSectionsByLand,
  listCropCatalog,
  createSectionCrop,
  keys: farmerCropsKeys,
  createSection,
};

export default farmerCropsApi;
