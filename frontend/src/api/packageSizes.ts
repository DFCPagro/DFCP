import { api } from "./config"; // axios instance
import type {
  PackageSize,
  Container,
  ListResponse,
  ListQuery,
} from "@/types/package-sizes";

/* ----------------------------- Package Sizes ----------------------------- */

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

/* -------------------------------- Containers ----------------------------- */

export async function listContainers(params: ListQuery = {}) {
  const res = await api.get<ListResponse<Container>>(
    "/package-sizes/containers",
    { params }
  );
  return res.data;
}

export async function getContainer(idOrKey: string) {
  const res = await api.get<Container>(`/package-sizes/containers/${idOrKey}`);
  return res.data;
}

export async function createContainer(payload: Partial<Container>) {
  const res = await api.post<Container>("/package-sizes/containers", payload);
  return res.data;
}

export async function updateContainer(idOrKey: string, payload: Partial<Container>) {
  const res = await api.patch<Container>(
    `/package-sizes/containers/${idOrKey}`,
    payload
  );
  return res.data;
}

export async function deleteContainer(idOrKey: string) {
  await api.delete(`/package-sizes/containers/${idOrKey}`);
}
