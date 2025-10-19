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
  onSuccess?: (orderId: string) => void;
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
  // Defensive helpers
  const asNumber = (v: unknown): number | undefined => {
    if (v === null || v === undefined || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  // Unit/weight quantities (keep exactly one, according to what is present)
  const quantityUnits = asNumber((line as any).units ?? (line as any).quantity);
  const quantityKg = asNumber(
    (line as any).quantity * (line as any).weightPerUnitKg
  );

  // Optional estimates snapshot (pass only if meaningful)
  const avgWeightPerUnitKg = asNumber((line as any).avgWeightPerUnitKg);
  const estimatesSnapshot: CreateOrderItemInput["estimatesSnapshot"] =
    avgWeightPerUnitKg && avgWeightPerUnitKg > 0
      ? { avgWeightPerUnitKg }
      : undefined;

  // Decide unitMode: prefer the cart line's value; otherwise infer from which qty is present
  const unitMode: UnitMode = (() => {
    const v = (line as any).unitMode;
    if (v === "unit" || v === "kg" || v === "mixed") return v as UnitMode;
    if (typeof quantityUnits === "number" && quantityUnits > 0 && !quantityKg)
      return "unit";
    if (typeof quantityKg === "number" && quantityKg > 0 && !quantityUnits)
      return "kg";
    return "unit"; // sensible default
  })();

  // Build the item strictly to the type (no extras)
  const out: CreateOrderItemInput = {
    itemId: String((line as any).itemId ?? (line as any).id ?? ""),
    name: String((line as any).name ?? ""),
    unitMode,
    imageUrl: ((): string | undefined => {
      const v = (line as any).imageUrl;
      if (v === null || v === undefined || v === "") return undefined;
      return String(v);
    })(),
    category: ((): string | undefined => {
      const v = (line as any).category;
      if (v === null || v === undefined || v === "") return undefined;
      return String(v);
    })(),
    pricePerUnit: ((): number => {
      const n = asNumber((line as any).pricePerUnit);
      return typeof n === "number" && n >= 0 ? n : 0;
    })(),
    // provenance fields (only if they exist on the cart line)
    sourceFarmerName: ((): string | undefined => {
      const v = (line as any).sourceFarmerName;
      return v ? String(v) : undefined;
    })(),
    sourceFarmName: ((): string | undefined => {
      const v = (line as any).sourceFarmName;
      console.log("sourceFarmName", { v });
      return v ? String(v) : undefined;
    })(),
    farmerOrderId: ((): string | undefined => {
      const v = (line as any).farmerOrderId;
      return v ? String(v) : undefined;
    })(),

    // quantities — include only the ones that are defined and valid
    ...(typeof quantityUnits === "number" && quantityUnits > 0
      ? { quantity: quantityUnits }
      : {}),
    ...(typeof quantityKg === "number" && quantityKg > 0 ? { quantityKg } : {}),

    // estimates snapshot (if present)
    ...(estimatesSnapshot ? { estimatesSnapshot } : {}),
  };

  return out;
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
      // Keep only valid items
      const hasId = !!it.itemId;
      const hasAnyQty =
        (typeof (it as any).quantity === "number" &&
          (it as any).quantity > 0) ||
        (typeof (it as any).quantityKg === "number" &&
          (it as any).quantityKg > 0);
      return hasId && hasAnyQty;
    });
  }, [deps.cartLines]);

  /* ---------------------------- Compute canSubmit ----------------------------- */

  const canSubmit = useMemo(() => {
    const { amsId, logisticsCenterId, deliveryDate, shiftName, address } =
      deps.context;

    if (
      !amsId ||
      !logisticsCenterId ||
      !deliveryDate ||
      !shiftName ||
      !address
    ) {
      return false;
    }
    if (!method) return false;

    // If method requires card, do a minimal UI validation
    if (String(method).toLowerCase() === "card") {
      if (
        !card.holder.trim() ||
        !/^\d[\d\s-]{11,}$/.test(card.cardNumber) || // basic 12+ digits allowance
        !/^\d{2}$/.test(card.expMonth) ||
        !/^\d{2,4}$/.test(card.expYear) ||
        !/^\d{3,4}$/.test(card.cvc)
      ) {
        return false;
      }
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
        lng: address!.lnt,
        lat: address!.alt,
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

      // If your API returns an id you want to surface:
      const orderId =
        (result as any)?.data?.id ??
        (result as any)?.id ??
        (result as any)?.data?.orderId ??
        (result as any)?.orderId;

      if (orderId && typeof deps.onSuccess === "function") {
        deps.onSuccess(String(orderId));
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
