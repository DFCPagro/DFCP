import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShelvesAPI } from "@/api/shelves.api";
import type { ShelfDTO } from "@/types/logisticCenter";

/** Try to parse row/col from "A-3-6" / "A_3_6" etc. */
function parseRowColFromShelfId(shelfId?: string) {
  if (!shelfId) return null;
  const m = String(shelfId).match(/^([A-Za-z]+)[-_](\d+)[-_](\d+)$/);
  if (!m) return null;
  return { row: Number(m[2]), col: Number(m[3]) };
}

/** Group shelves into the structure the map needs: zone -> "r-c" -> ShelfDTO|null */
export function groupShelvesToCells(shelves: ShelfDTO[]) {
  const out: Record<string, Record<string, ShelfDTO | null>> = {};
  for (const s of shelves) {
    const zone = (s.zone || "UNK").toUpperCase();
    let row = s.row ?? 0;
    let col = s.col ?? 0;

    // Fallback: derive row/col from shelfId like "A-3-6"
    if (!(row > 0 && col > 0)) {
      const parsed = parseRowColFromShelfId(s.shelfId);
      if (parsed) {
        row = parsed.row;
        col = parsed.col;
      }
    }

    if (!out[zone]) out[zone] = {};
    if (row > 0 && col > 0) {
      out[zone][`${row}-${col}`] = s;
    }
  }
  return out;
}

/** Fetch shelves for a center with optional { zone, type } filters. */
export function useShelves(centerId: string, params?: { zone?: string; type?: string }) {
  const query = useQuery({
    queryKey: ["shelves", { centerId, ...params }],
    queryFn: () => ShelvesAPI.list({ centerId, zone: params?.zone, type: params?.type }),
    enabled: !!centerId,
    staleTime: 15_000,
  });

  const shelvesByZone = useMemo(() => groupShelvesToCells(query.data ?? []), [query.data]);

  return { ...query, shelvesByZone };
}

/** Convenience: get a shelf with live crowd info */
export function useShelfWithCrowd(shelfId?: string) {
  return useQuery({
    queryKey: ["shelf", shelfId, "withCrowd"],
    queryFn: () => ShelvesAPI.getWithCrowd(shelfId!),
    enabled: !!shelfId,
    staleTime: 5_000,
  });
}

/** Mutations */
export function usePlaceContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { shelfMongoId: string; slotId: string; containerOpsId: string; weightKg: number }) =>
      ShelvesAPI.place(args.shelfMongoId, {
        slotId: args.slotId,
        containerOpsId: args.containerOpsId,
        weightKg: args.weightKg,
      }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["shelves"] });
      qc.invalidateQueries({ queryKey: ["shelf", vars.shelfMongoId, "withCrowd"] });
    },
  });
}

export function useConsumeFromSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { shelfMongoId: string; slotId: string; amountKg: number }) =>
      ShelvesAPI.consume(args.shelfMongoId, args.slotId, args.amountKg),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["shelves"] });
      qc.invalidateQueries({ queryKey: ["shelf", vars.shelfMongoId, "withCrowd"] });
    },
  });
}

export function useMoveContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { fromShelfId: string; fromSlotId: string; toShelfId: string; toSlotId: string }) =>
      ShelvesAPI.move(args),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shelves"] }),
  });
}

export function useRefillFromWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ShelvesAPI.refillFromWarehouse,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shelves"] }),
  });
}

export function useEmptySlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { shelfMongoId: string; slotId: string; toArea?: "warehouse" | "out" }) =>
      ShelvesAPI.emptySlot(args.shelfMongoId, args.slotId, args.toArea ?? "warehouse"),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["shelves"] });
      qc.invalidateQueries({ queryKey: ["shelf", vars.shelfMongoId, "withCrowd"] });
    },
  });
}

export function useCrowdMarks() {
  const qc = useQueryClient();
  const start = useMutation({
    mutationFn: (args: { shelfId: string; kind: "pick" | "sort" | "audit" }) => ShelvesAPI.markStart(args.shelfId, args.kind),
    onSuccess: (_res, vars) => qc.invalidateQueries({ queryKey: ["shelf", vars.shelfId, "withCrowd"] }),
  });
  const end = useMutation({
    mutationFn: (args: { shelfId: string; kind: "pick" | "sort" | "audit" }) => ShelvesAPI.markEnd(args.shelfId, args.kind),
    onSuccess: (_res, vars) => qc.invalidateQueries({ queryKey: ["shelf", vars.shelfId, "withCrowd"] }),
  });
  return { start, end };
}
