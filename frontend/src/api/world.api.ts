// FILE: src/api/world.ts
import { api } from "@/api/config"; // your axios instance
import type { WorldSpec } from "@/types/logisticCenter";

export async function fetchWorldSpec(centerId: string, minCellW = 70, minCellH = 66): Promise<WorldSpec> {
  const res = await api.get<{ ok: boolean; data: WorldSpec }>(
    `/world-layout/by-center/${centerId}`,
    { params: { minCellW, minCellH } }
  );
  if (!res.data?.ok) throw new Error("Failed to load world spec");
  return res.data.data;
}
