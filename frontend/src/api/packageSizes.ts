import { api } from "./config"; // assumes your provided axios instance is exported from here
import type { PackageSize, ListResponse, ListQuery } from "@/types/package-sizes";

export async function listPackageSizes(params: ListQuery = {}) {
  const res = await api.get<ListResponse<PackageSize>>("/package-sizes", { params });
  return res.data;
}

export async function getPackageSize(idOrKey: string) {
  const res = await api.get<PackageSize>(`/package-sizes/${idOrKey}`);
  return res.data;
}

export async function createPackageSize(payload: Partial<PackageSize>) {
  const res = await api.post<PackageSize>("/package-sizes", payload);
  return res.data;
}

export async function updatePackageSize(idOrKey: string, payload: Partial<PackageSize>) {
  const res = await api.patch<PackageSize>(`/package-sizes/${idOrKey}`, payload);
  return res.data;
}

export async function deletePackageSize(idOrKey: string) {
  await api.delete(`/package-sizes/${idOrKey}`);
}
