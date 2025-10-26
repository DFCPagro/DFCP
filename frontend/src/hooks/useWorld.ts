// FILE: src/hooks/useWorld.ts
import { useQuery } from "@tanstack/react-query";
import { fetchWorldSpec } from "@/api/world.api";
import type { WorldSpec } from "@/types/logisticCenter";

export function useWorldSpec(centerId: string, opts?: { minCellW?: number; minCellH?: number }) {
  const minCellW = opts?.minCellW ?? 70;
  const minCellH = opts?.minCellH ?? 66;

  return useQuery<WorldSpec>({
    queryKey: ["world-spec", centerId, minCellW, minCellH],
    queryFn: () => fetchWorldSpec(centerId, minCellW, minCellH),
    enabled: !!centerId,
    staleTime: 60_000,
  });
}
