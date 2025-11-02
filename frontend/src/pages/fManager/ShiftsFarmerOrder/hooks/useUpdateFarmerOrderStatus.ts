// src/pages/ShiftFarmerOrder/hooks/useUpdateFarmerOrderStatus.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toaster } from "@/components/ui/toaster";
import { updateFarmerOrderStatus } from "@/api/farmerOrders";
import type {
  FarmerOrderStatus,
  ShiftFarmerOrderItem,
} from "@/types/farmerOrders";

/** The list cache can be either a plain array or an object with { items } */
type FarmerOrdersByShiftCache =
  | ShiftFarmerOrderItem[]
  | {
      meta?: Record<string, unknown>;
      items: ShiftFarmerOrderItem[];
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

export function useUpdateFarmerOrderStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: {
      orderId: string;
      status: FarmerOrderStatus;
      note?: string;
    }) => {
      const { orderId, status, note } = vars;
      return updateFarmerOrderStatus(orderId, status, note);
    },

    // ---------- Optimistic update across ALL "farmerOrders/byShift" caches ----------
    onMutate: async ({ orderId, status }) => {
      // Cancel any in-flight queries for these lists so they don't overwrite us
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
            return old.map((it) =>
              (it as any)?._id === orderId
                ? { ...it, farmerStatus: status }
                : it
            );
          }

          // Case B: cache is an object with { items }
          if (hasItemsProp(old)) {
            const items = old.items.map((it) =>
              (it as any)?._id === orderId
                ? { ...it, farmerStatus: status }
                : it
            );
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
    onError: (err, _vars, ctx) => {
      const snapshots = (ctx as any)?.snapshots as
        | Array<[unknown, FarmerOrdersByShiftCache | undefined]>
        | undefined;
      if (snapshots) {
        snapshots.forEach(([qk, prev]) => qc.setQueryData(qk as any, prev));
      }
      toaster.create({
        type: "error",
        title: "Failed to update status",
        description:
          (err as Error)?.message ??
          "The server could not update the farmer status.",
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
        { predicate: ({ queryKey }) => isByShiftKey(queryKey) },
        updater
      );

      toaster.create({
        type: "success",
        title: "Status updated",
      });
    },

    // ---------- Optional: refetch to ensure full consistency ----------
    onSettled: () => {
      qc.invalidateQueries({
        predicate: ({ queryKey }) => isByShiftKey(queryKey),
      });
    },
  });
}
