// src/pages/CreateStock/hooks/useCreateStockInit.ts
import { useCallback, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { toaster } from "@/components/ui/toaster";
import { initAvailableStock } from "@/api/availableStock";
import { ShiftEnum, type Shift, IsoDateString } from "@/types/farmerOrders";

export type CreateStockInitArgs = {
  /** "YYYY-MM-DD" (local date) */
  date: string | null | undefined;
  /** "morning" | "afternoon" | "evening" | "night" */
  shiftName: string | null | undefined;
};

export type CreateStockInitResult = {
  /** The newly created AMS id */
  amsId: string;
};

function titleCase(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Page-local hook to initialize available stock (AMS) for a (date, shift).
 * - Validates incoming params from the URL
 * - Exposes an `init()` that calls POST /available-stock/init
 * - Surfaces loading/error states and the resulting { amsId }
 */
export function useCreateStockInit(params: CreateStockInitArgs) {
  // Validate/normalize URL params once, so mutation receives clean inputs
  const parsed = useMemo(() => {
    const dateOk =
      !!params.date && IsoDateString.safeParse(params.date).success;
    const shiftOk =
      !!params.shiftName &&
      ShiftEnum.safeParse(params.shiftName.toLowerCase()).success;

    return {
      valid: dateOk && shiftOk,
      date: (dateOk ? params.date : null) as string | null,
      shift: (shiftOk
        ? (params.shiftName!.toLowerCase() as Shift)
        : null) as Shift | null,
      errors: {
        date: dateOk ? null : "Expected date=YYYY-MM-DD",
        shift: shiftOk
          ? null
          : "Expected shift=morning|afternoon|evening|night",
      },
    };
  }, [params.date, params.shiftName]);

  const mutation = useMutation({
    mutationKey: ["availableStock", "init", parsed.date, parsed.shift],
    mutationFn: async () => {
      if (!parsed.valid || !parsed.date || !parsed.shift) {
        throw new Error(
          `Invalid parameters. ${parsed.errors.date ?? ""} ${parsed.errors.shift ?? ""}`.trim()
        );
      }
      return initAvailableStock({ date: parsed.date, shiftName: parsed.shift });
    },
    onSuccess: (res) => {
      toaster.create({
        type: "success",
        title: "Stock initialized",
        description: `AMS ${res.amsId} created for ${parsed.date} · ${titleCase(parsed.shift!)}`,
        duration: 2500,
      });
    },
    onError: (err: unknown) => {
      const msg =
        (typeof err === "object" &&
          err &&
          "message" in err &&
          (err as any).message) ||
        "Failed to initialize stock";
      toaster.create({
        type: "error",
        title: "Initialization failed",
        description: String(msg),
      });
    },
  });

  const init = useCallback(async () => {
    return mutation.mutateAsync();
  }, [mutation]);

  const { status, error, data } = mutation;

  return {
    // validation
    valid: parsed.valid,
    errors: parsed.errors,
    date: parsed.date,
    shift: parsed.shift,

    // mutation
    init,
    status, // 'idle' | 'pending' | 'success' | 'error'
    isPending: status === "pending",
    isSuccess: status === "success",
    isError: status === "error",
    error,

    // result
    result: data ?? null,
  };
}
