// src/pages/checkout/hooks/usePayment.ts

import { useCallback, useMemo, useState } from "react";
import { toaster } from "@/components/ui/toaster";
import {
  type CreateOrderBody,
  type CreateOrderItemInput,
  type PaymentMethod,
  type UnitMode,
} from "@/types/orders"; // make sure this path matches
import { createOrder } from "@/api/orders";
import type { Address } from "@/types/address";
import type { CartLine as SharedCartLine } from "@/utils/market/marketCart.shared";

/* -------------------------------------------------------------------------- */
/*                               Local UI Types                                */
/* -------------------------------------------------------------------------- */

type CardState = {
  holder: string;
  cardNumber: string;
  expMonth: string; // "MM"
  expYear: string; // "YY" or "YYYY"
  cvc: string; // 3–4 digits
};

type UsePaymentDeps = {
  context: {
    amsId: string | null;
    logisticsCenterId: string | null; // may be redundant if address also has it
    deliveryDate: string | null; // yyyy-mm-dd
    shiftName: string | null;
    address: Address | null; // deliveryAddress in body
  };
  cartLines: SharedCartLine[];
  onSuccess?: () => void;
};

/* -------------------------------------------------------------------------- */
/*        CartLine -> CreateOrderItemInput (STRICT MAPPER, FINAL VERSION)     */
/* -------------------------------------------------------------------------- */

function cartLineToCreateOrderItemInput(
  line: SharedCartLine
): CreateOrderItemInput {
  const rawMode = (line as any).unitMode;
  const unitMode: UnitMode =
    rawMode === "unit" || rawMode === "kg" || rawMode === "mixed"
      ? rawMode
      : "kg";

  const qty = Number((line as any).quantity) || 0;

  const avgPerUnitKg =
    typeof (line as any).avgWeightPerUnitKg === "number" &&
    (line as any).avgWeightPerUnitKg > 0
      ? (line as any).avgWeightPerUnitKg
      : undefined;

  const base: Omit<CreateOrderItemInput, "unitMode"> & { unitMode: UnitMode } = {
    itemId: String((line as any).itemId ?? (line as any).id ?? ""),

    farmerOrderId: ((): string | undefined => {
      const v = (line as any).farmerOrderId;
      return v ? String(v) : undefined;
    })(),

    sourceFarmerName:
      (line as any).farmerName ??
      (line as any).sourceFarmerName ??
      "Unknown Farmer",

    sourceFarmName:
      (line as any).farmName ??
      (line as any).sourceFarmName ??
      "Unknown Farm",

    name: (line as any).name
      ? String((line as any).name)
      : undefined,

    imageUrl: ((): string | undefined => {
      const v = (line as any).imageUrl;
      return v ? String(v) : undefined;
    })(),

    category: ((): string | undefined => {
      const v = (line as any).category;
      return v ? String(v) : undefined;
    })(),

    pricePerUnit: Number((line as any).pricePerUnit) || 0,

    unitMode,
  };

  if (unitMode === "unit") {
    return {
      ...base,
      units: qty,
      quantityKg: 0,
      estimatesSnapshot:
        avgPerUnitKg && avgPerUnitKg > 0
          ? { avgWeightPerUnitKg: avgPerUnitKg }
          : undefined,
    };
  }

  if (unitMode === "kg") {
    return {
      ...base,
      quantityKg: qty,
      units: 0,
    };
  }

  // "mixed" fallback for future
  return {
    ...base,
    unitMode: "mixed",
    units: qty,
    quantityKg: 0,
    estimatesSnapshot:
      avgPerUnitKg && avgPerUnitKg > 0
        ? { avgWeightPerUnitKg: avgPerUnitKg }
        : undefined,
  };
}

/* -------------------------------------------------------------------------- */
/*                                usePayment()                                 */
/* -------------------------------------------------------------------------- */

export function usePayment(deps: UsePaymentDeps) {
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
    if (!Array.isArray(deps.cartLines) || deps.cartLines.length === 0) {
      return [];
    }

    return deps.cartLines
      .map(cartLineToCreateOrderItemInput)
      .filter((it) => {
        const hasId = !!it.itemId;

        const hasAnyQty =
          (typeof it.units === "number" && it.units > 0) ||
          (typeof it.quantityKg === "number" && it.quantityKg > 0);

        const needsAvg =
          (it.unitMode === "unit" || it.unitMode === "mixed") &&
          (it.units ?? 0) > 0;

        const hasAvg =
          !needsAvg ||
          ((it.estimatesSnapshot?.avgWeightPerUnitKg ?? 0) > 0);

        return hasId && hasAnyQty && hasAvg;
      });
  }, [deps.cartLines]);

  /* ---------------------------- Compute canSubmit ----------------------------- */

  const canSubmit = useMemo(() => {
    const { amsId, deliveryDate, address } = deps.context;

    // IMPORTANT: logisticsCenterId actually comes from address.logisticCenterId now.
    // We just need to make sure we have it.
    const lcFromAddress =
      (address && (address as any).logisticCenterId) ||
      deps.context.logisticsCenterId;

    if (!amsId || !deliveryDate || !address || !lcFromAddress) return false;
    if (!method) return false;

    if (String(method).toLowerCase() === "card") {
      if (
        !card.holder.trim() ||
        !/^\d[\d\s-]{11,}$/.test(card.cardNumber) ||
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

    const {
      amsId,
      deliveryDate,
      shiftName,
      address,
    } = deps.context;

    // authoritative LC id = from address
    const lcFromAddress =
      (address && (address as any).logisticCenterId) ||
      deps.context.logisticsCenterId;

    const body: CreateOrderBody = {
      amsId: amsId!, // required by backend
      logisticsCenterId: lcFromAddress!, // lowercase L, matches backend zod
      deliveryDate: deliveryDate!, // "YYYY-MM-DD"
      shiftName: shiftName || "", // backend ignores this; it'll use AMS.availableShift
      deliveryAddress: {
        address: address!.address,
        lnt: address!.lnt,
        alt: address!.alt,
        // include logisticCenterId on the address too, if present
        ...(lcFromAddress
          ? { logisticCenterId: lcFromAddress }
          : {}),
      },
      items: orderItems,
      // tolerancePct?: you can add later from UI
    };

    console.log("Submitting order", { body });

    try {
      setSubmitting(true);

      const result = await createOrder(body);

      toaster.create({
        title: "Order placed",
        description: "Your order was submitted successfully.",
        type: "success",
      });

      console.log("Order created", result);

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
