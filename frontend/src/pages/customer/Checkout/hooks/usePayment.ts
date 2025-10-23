// src/pages/checkout/hooks/usePayment.ts
import { useCallback, useMemo, useState } from "react";
import { toaster } from "@/components/ui/toaster";
import {
  type CreateOrderBody,
  type CreateOrderItemInput,
  type PaymentMethod,
  type UnitMode,
} from "@/types/orders";
import { createOrder } from "@/api/orders";
import type { Address } from "@/types/address";
import type { CartLine as SharedCartLine } from "@/utils/marketCart.shared";

/* -------------------------------------------------------------------------- */
/*                               Local UI Types                                */
/* -------------------------------------------------------------------------- */

type CardState = {
  holder: string;
  cardNumber: string;
  expMonth: string; // "MM"
  expYear: string; // "YY" or "YYYY" (UI-level, normalize on submit if needed)
  cvc: string; // 3–4 digits
};

type UsePaymentDeps = {
  /** What the page already collects (unchanged for callers) */
  context: {
    amsId: string | null;
    logisticsCenterId: string | null; // note: will be adapted to LogisticsCenterId in the body
    deliveryDate: string | null; // ISO yyyy-mm-dd
    shiftName: string | null;
    address: Address | null; // deliveryAddress in the body
  };
  /** Lines from the Market cart (unchanged shape for callers) */
  cartLines: SharedCartLine[];
  /** Optional success handler */
  onSuccess?: () => void;
};

/* -------------------------------------------------------------------------- */
/*                Cart → CreateOrderItemInput (strict, minimal)               */
/* -------------------------------------------------------------------------- */

/**
 * Minimal, lossy-safe mapper:
 *  - Reads only the fields that exist on CreateOrderItemInput
 *  - Does NOT invent additional properties
 *  - Coerces numbers defensively
 */
function mapCartLineToOrderItem(line: SharedCartLine): CreateOrderItemInput {
  const num = (v: unknown): number | undefined => {
    if (v == null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const explicitUnitMode = (line as any).unitMode;
  const legacyQtyKg = num((line as any).quantity); // 👈 fallback (your cart has this)

  // Prefer explicit mode; otherwise infer from present fields
  const unitMode: UnitMode = (() => {
    const v = explicitUnitMode;
    if (v === "unit" || v === "kg" || v === "mixed") return v as UnitMode;
    if (num((line as any).units)) return "unit";
    if (num((line as any).quantityKg)) return "kg";
    if (legacyQtyKg) return "kg"; // 👈 legacy implies kg
    return "kg";
  })();

  // Use explicit fields; if missing, fall back to legacy quantity→kg
  const units = num((line as any).units);
  const quantityKg = num((line as any).quantityKg) ?? legacyQtyKg; // 👈 here

  // avgWeightPerUnitKg is REQUIRED only when reserving by units
  const avgWeightPerUnitKg = num((line as any).avgWeightPerUnitKg);
  const estimatesSnapshot =
    (unitMode === "unit" || unitMode === "mixed") && (units ?? 0) > 0
      ? avgWeightPerUnitKg && avgWeightPerUnitKg > 0
        ? { avgWeightPerUnitKg }
        : undefined
      : avgWeightPerUnitKg && avgWeightPerUnitKg > 0
        ? { avgWeightPerUnitKg }
        : undefined;

  return {
    itemId: String((line as any).itemId ?? (line as any).id ?? ""),
    name: (line as any).name ? String((line as any).name) : undefined,
    imageUrl: ((): string | undefined => {
      const v = (line as any).imageUrl;
      return v ? String(v) : undefined;
    })(),
    category: ((): string | undefined => {
      const v = (line as any).category;
      return v ? String(v) : undefined;
    })(),
    pricePerUnit: Number((line as any).pricePerUnit) || 0, // per KG

    unitMode,
    farmerOrderId: ((): string | undefined => {
      const v = (line as any).farmerOrderId;
      return v ? String(v) : undefined;
    })(),
    sourceFarmerName: ((): string | undefined => {
      const v = (line as any).sourceFarmerName;
      return v ? String(v) : undefined;
    })(),
    sourceFarmName: ((): string | undefined => {
      const v = (line as any).sourceFarmName;
      return v ? String(v) : undefined;
    })(),

    ...(typeof units === "number" && units > 0 ? { units } : {}),
    ...(typeof quantityKg === "number" && quantityKg > 0 ? { quantityKg } : {}),
    ...(estimatesSnapshot ? { estimatesSnapshot } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/*                                Hook: Public                                 */
/* -------------------------------------------------------------------------- */

export function usePayment(deps: UsePaymentDeps) {
  // Payment method and card UI (unchanged external API)
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [card, setCard] = useState<CardState>({
    holder: "",
    cardNumber: "",
    expMonth: "",
    expYear: "",
    cvc: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const setCardField = useCallback(
    (field: keyof CardState, value: string) =>
      setCard((prev) => ({ ...prev, [field]: value })),
    []
  );

  /* ----------------------------- Build order items ----------------------------- */

  const orderItems: CreateOrderItemInput[] = useMemo(() => {
    console.log("Building order items", { cartLines: deps.cartLines });
    if (!Array.isArray(deps.cartLines) || deps.cartLines.length === 0)
      return [];
    return deps.cartLines.map(mapCartLineToOrderItem).filter((it) => {
      const hasId = !!it.itemId;
      const hasAnyQty =
        (typeof it.units === "number" && it.units > 0) ||
        (typeof it.quantityKg === "number" && it.quantityKg > 0);
      const needsAvg =
        (it.unitMode === "unit" || it.unitMode === "mixed") &&
        (it.units ?? 0) > 0;
      const hasAvg =
        !needsAvg || (it.estimatesSnapshot?.avgWeightPerUnitKg ?? 0) > 0;
      return hasId && hasAnyQty && hasAvg;
    });
  }, [deps.cartLines]);

  /* ---------------------------- Compute canSubmit ----------------------------- */

  const canSubmit = useMemo(() => {
    const { amsId, logisticsCenterId, deliveryDate, /* shiftName, */ address } =
      deps.context;

    if (!amsId || !logisticsCenterId || !deliveryDate || !address) return false;
    if (!method) return false;

    if (String(method).toLowerCase() === "card") {
      if (
        !card.holder.trim() ||
        !/^\d[\d\s-]{11,}$/.test(card.cardNumber) ||
        !/^\d{2}$/.test(card.expMonth) ||
        !/^\d{2,4}$/.test(card.expYear) ||
        !/^\d{3,4}$/.test(card.cvc)
      )
        return false;
    }

    return orderItems.length > 0;
  }, [deps.context, method, card, orderItems]);

  /* ------------------------------ Submit handler ------------------------------ */

  const submit = useCallback(async () => {
    if (!canSubmit) {
      toaster.create({
        title: "Missing information",
        description:
          "Please complete delivery details, payment method, and add at least one item.",
        type: "warning",
      });
      return;
    }

    const { amsId, logisticsCenterId, deliveryDate, shiftName, address } =
      deps.context;

    // Build the CreateOrderBody base strictly from the official type
    const body: CreateOrderBody = {
      amsId, // exact name per type
      LogisticsCenterId: logisticsCenterId!, // NOTE: capital L, per CreateOrderBody
      deliveryDate, // ISO yyyy-mm-dd
      shiftName,
      deliveryAddress: {
        address: address!.address,
        lnt: address!.lnt,
        alt: address!.alt,
      },
      items: orderItems,
      // Optional: tolerancePct — leave undefined to use backend default
    };
    console.log("Submitting order", { orderItems });
    try {
      setSubmitting(true);
      const result = await createOrder(body); // returns whatever your API returns

      toaster.create({
        title: "Order placed",
        description: "Your order was submitted successfully.",
        type: "success",
      });

      console.log("Order created");
      if (typeof deps.onSuccess === "function") {
        deps.onSuccess();
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        "We could not submit your order. Please try again.";
      toaster.create({
        title: "Order failed",
        description: message,
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, deps, orderItems]);

  /* --------------------------------- Exports --------------------------------- */

  return {
    method,
    setMethod,
    card,
    setCardField,
    canSubmit,
    submitting,
    submit,
  };
}
