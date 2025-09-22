import { useCallback, useMemo, useRef, useState } from "react";
import type { ListParams, PackageSizeListResponse, UpsertPayload } from "@/types/package-sizes";
import { createPackageSize, deletePackageSize, fetchPackageSizes, updatePackageSize } from "@/api/packageSizes";
import { toaster } from "@/components/ui/toaster";

// small debounce util
export function useDebouncedValue<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  const timeoutRef = useRef<number | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setDebounced(value), delay);
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [value, delay]);

  return debounced;
}

function showError(title: string, err: any) {
  const description =
    err?.response?.data?.message ??
    err?.message ??
    (typeof err === "string" ? err : "Unknown error");
  toaster.create({ type: "error", title, description, duration: 5000 });
}

export function usePackageSizes(initial: ListParams = {}) {
  const [params, setParams] = useState<ListParams>({ page: 1, limit: 10, sort: "key", ...initial });
  const [data, setData] = useState<PackageSizeListResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (overrides?: Partial<ListParams>) => {
      setLoading(true);
      try {
        const merged = { ...params, ...overrides };
        const res = await fetchPackageSizes(merged);
        setData(res);
        setParams(merged);
      } catch (err: any) {
        showError("Failed to load package sizes", err);
      } finally {
        setLoading(false);
      }
    },
    [params]
  );

  const createOne = useCallback(
    async (payload: UpsertPayload) => {
      const doc = await createPackageSize(payload).catch((err) => {
        showError("Create failed", err);
        throw err;
      });
      toaster.create({ type: "success", title: "Package size created" });
      await load();
      return doc;
    },
    [load]
  );

  const updateOne = useCallback(
    async (idOrKey: string, payload: Partial<UpsertPayload>) => {
      const doc = await updatePackageSize(idOrKey, payload).catch((err) => {
        showError("Update failed", err);
        throw err;
      });
      toaster.create({ type: "success", title: "Package size updated" });
      await load();
      return doc;
    },
    [load]
  );

  const removeOne = useCallback(
    async (idOrKey: string) => {
      await deletePackageSize(idOrKey).catch((err) => {
        showError("Delete failed", err);
        throw err;
      });
      toaster.create({ type: "success", title: "Package size deleted" });
      await load();
    },
    [load]
  );

  return {
    params,
    setParams,
    data,
    loading,
    load,
    createOne,
    updateOne,
    removeOne,
  };
}
