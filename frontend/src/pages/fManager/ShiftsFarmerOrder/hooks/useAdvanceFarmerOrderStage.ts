// src/pages/ShiftFarmerOrder/hooks/useAdvanceFarmerOrderStage.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  advanceFarmerOrderStage,
  type AdvanceFarmerOrderStageBody,
} from "@/api/farmerOrders";
import type { ShiftFarmerOrderItem } from "@/types/farmerOrders";

/** The list cache can be either a plain array or an object with { items } */
type FarmerOrdersByShiftCache =
  | ShiftFarmerOrderItem[]
  | {
      meta?: Record<string, unknown>;
      items: ShiftFarmerOrderItem[];
    };

export type AdvanceStageVars = AdvanceFarmerOrderStageBody & {
  orderId: string;
};

const isByShiftKey = (qk: unknown) =>
  Array.isArray(qk) &&
  // current API key family
  ((qk[0] === "farmerOrders" && qk[1] === "byShift") ||
    // legacy/sandbox family you previously matched
    qk[0] === "farmer-orders-by-shift");

/** Type guard to narrow the cache to the { items } shape */
function hasItemsProp(
  v: FarmerOrdersByShiftCache
): v is { items: ShiftFarmerOrderItem[]; meta?: Record<string, unknown> } {
  return !!v && !Array.isArray(v) && Array.isArray((v as any).items);
}

export function useAdvanceFarmerOrderStage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: AdvanceStageVars) => {
      const { orderId, ...body } = vars;
      return advanceFarmerOrderStage(orderId, body);
    },

    // ---------- Optimistic update across ALL "farmer-orders-by-shift" caches ----------
    onMutate: async (vars) => {
      const { orderId, key: nextKey } = vars;

      // Cancel any in-flight queries for these lists
      await qc.cancelQueries({
        predicate: ({ queryKey }) => isByShiftKey(queryKey),
      });

      // Snapshot all matching caches for rollback
      const snapshots = qc.getQueriesData<FarmerOrdersByShiftCache>({
        predicate: ({ queryKey }) => isByShiftKey(queryKey),
      });

      // Apply optimistic change to every matching cache
      snapshots.forEach(([qk, prev]) => {
        if (!prev) return;

        qc.setQueryData<FarmerOrdersByShiftCache>(qk, (old) => {
          if (!old) return old;

          // Case A: cache is a plain array
          if (Array.isArray(old)) {
            return old.map((it) => {
              if ((it as any)?._id !== orderId) return it;

              const copy: any = { ...it };
              const stages: any[] = Array.isArray(copy.stages)
                ? [...copy.stages]
                : [];
              const nowISO = new Date().toISOString();

              const currentIdx = stages.findIndex(
                (s) => (s?.status ?? "").toLowerCase() === "current"
              );
              const fallbackIdx =
                currentIdx === -1 && copy.stageKey
                  ? stages.findIndex((s) => s?.key === copy.stageKey)
                  : -1;
              const fromIdx = currentIdx !== -1 ? currentIdx : fallbackIdx;

              if (fromIdx !== -1 && stages[fromIdx]) {
                stages[fromIdx] = {
                  ...stages[fromIdx],
                  status: "done",
                  completedAt: stages[fromIdx]?.completedAt ?? nowISO,
                };
              }

              let toIdx = stages.findIndex((s) => s?.key === nextKey);
              if (toIdx === -1) {
                stages.push({
                  key: nextKey,
                  status: "current",
                  startedAt: nowISO,
                });
                toIdx = stages.length - 1;
              } else {
                stages[toIdx] = {
                  ...stages[toIdx],
                  status: "current",
                  startedAt: stages[toIdx]?.startedAt ?? nowISO,
                };
              }

              copy.stages = stages;
              copy.stageKey = nextKey;

              return copy as ShiftFarmerOrderItem;
            });
          }

          // Case B: cache is an object with { items }
          if (hasItemsProp(old)) {
            const items = old.items.map((it) => {
              if ((it as any)?._id !== orderId) return it;

              const copy: any = { ...it };
              const stages: any[] = Array.isArray(copy.stages)
                ? [...copy.stages]
                : [];
              const nowISO = new Date().toISOString();

              const currentIdx = stages.findIndex(
                (s) => (s?.status ?? "").toLowerCase() === "current"
              );
              const fallbackIdx =
                currentIdx === -1 && copy.stageKey
                  ? stages.findIndex((s) => s?.key === copy.stageKey)
                  : -1;
              const fromIdx = currentIdx !== -1 ? currentIdx : fallbackIdx;

              if (fromIdx !== -1 && stages[fromIdx]) {
                stages[fromIdx] = {
                  ...stages[fromIdx],
                  status: "done",
                  completedAt: stages[fromIdx]?.completedAt ?? nowISO,
                };
              }

              let toIdx = stages.findIndex((s) => s?.key === nextKey);
              if (toIdx === -1) {
                stages.push({
                  key: nextKey,
                  status: "current",
                  startedAt: nowISO,
                });
                toIdx = stages.length - 1;
              } else {
                stages[toIdx] = {
                  ...stages[toIdx],
                  status: "current",
                  startedAt: stages[toIdx]?.startedAt ?? nowISO,
                };
              }

              copy.stages = stages;
              copy.stageKey = nextKey;

              return copy as ShiftFarmerOrderItem;
            });

            return { ...old, items };
          }

          // Fallback (shouldn't hit)
          return old;
        });
      });

      // Context for rollback
      return { snapshots };
    },

    // ---------- Rollback on error ----------
    onError: (_err, _vars, ctx) => {
      const snapshots = (ctx as any)?.snapshots as
        | Array<[unknown, FarmerOrdersByShiftCache | undefined]>
        | undefined;
      if (!snapshots) return;
      snapshots.forEach(([qk, prev]) => {
        qc.setQueryData(qk as any, prev);
      });
    },

    // ---------- Replace optimistic with server result ----------
    onSuccess: (updatedItem) => {
      const updater = (old?: FarmerOrdersByShiftCache) => {
        if (!old) return old;

        // Case A: cache is a plain array
        if (Array.isArray(old)) {
          return old.map((it) =>
            (it as any)?._id === (updatedItem as any)?._id
              ? (updatedItem as ShiftFarmerOrderItem)
              : it
          );
        }

        // Case B: cache is an object with { items }
        if (hasItemsProp(old)) {
          const items = old.items.map((it) =>
            (it as any)?._id === (updatedItem as any)?._id
              ? (updatedItem as ShiftFarmerOrderItem)
              : it
          );
          return { ...old, items };
        }

        return old;
      };

      qc.setQueriesData<FarmerOrdersByShiftCache>(
        {
          predicate: ({ queryKey }) => isByShiftKey(queryKey),
        },
        updater
      );
    },

    // ---------- Optional: refetch the same family to ensure full consistency ----------
    onSettled: () => {
      qc.invalidateQueries({
        predicate: ({ queryKey }) => isByShiftKey(queryKey),
      });
    },
  });
}
