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

/* -------------------------------------------------------------------------- */
/* Types expected from the new checkout state                                  */
/* -------------------------------------------------------------------------- */

export type CheckoutContext = {
  amsId: string | null;
  logisticsCenterId: string | null;
  deliveryDate: string | null; // ISO yyyy-mm-dd
  shiftName: string | null;
  /** optional in the new flow; include if you have it */
  address?: unknown | null;
};

export type SharedCartLine = {
  key?: string;
  stockId?: string;
  itemId?: string;
  id?: string;
  quantity?: number;
  quantityKg?: number;
  units?: number;
  unitMode?: UnitMode;

  // pricing
  unitPriceUsd?: number;
  pricePerUnit?: number; // per KG in your backend definition
  pricePerKg?: number;

  // display
  name?: string;
  displayName?: string;
  imageUrl?: string;
  category?: string;
  farmerName?: string;
  farmName?: string;

  // estimates
  avgWeightPerUnitKg?: number;

  // original nested item (from market)
  item?: any;

  // provenance (pass through if present)
  sourceFarmerName?: string;
  sourceFarmName?: string;
  farmerOrderId?: string;
  [k: string]: unknown;
};

export type MoneyTotals = {
  itemCount: number;
  subtotal: number;
};

export function usePayment(deps: {
  context: CheckoutContext;
  cartLines: SharedCartLine[];
  totals: MoneyTotals; // from the new hook; server is still source of truth
  onSuccess?: (orderId: string) => void;
}) {
  /* -------------------------------- UI state ------------------------------- */
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [submitting, setSubmitting] = useState(false);

  type CardState = {
    holder: string;
    cardNumber: string;
    expMonth: string; // keep as string for inputs; validate/convert on submit
    expYear: string;
    cvc: string;
  };
  const [card, setCard] = useState<CardState>({
    holder: "",
    cardNumber: "",
    expMonth: "",
    expYear: "",
    cvc: "",
  });
  const setCardField = useCallback(
    (k: keyof CardState, v: string) => setCard((s) => ({ ...s, [k]: v })),
    []
  );

  const cardValid = useMemo(() => {
    if (method !== "card") return true;
    const month = Number(card.expMonth);
    const year = Number(card.expYear);
    const cardNum = card.cardNumber.replace(/\s+/g, "");
    return (
      card.holder.trim().length >= 2 &&
      /^\d{12,19}$/.test(cardNum) &&
      month >= 1 &&
      month <= 12 &&
      year >= new Date().getFullYear() &&
      /^\d{3,4}$/.test(card.cvc)
    );
  }, [method, card]);

  /* ---------------------------- Mapping (cart → order) ---------------------------- */

  const mapCartLineToOrderItem = useCallback(
    (line: SharedCartLine): CreateOrderItemInput => {
      // Identity
      const itemId: string =
        (line.itemId as string) ??
        (line.id as string) ??
        (line.item?.itemId as string) ??
        (line.item?._id as string) ??
        String(line.stockId ?? line.key ?? "");

      // Display
      const name: string | undefined =
        (line.name as string) ??
        (line.displayName as string) ??
        (line.item?.displayName as string) ??
        (line.item?.name as string);
      const imageUrl: string | undefined =
        (line.imageUrl as string) ??
        (line.item?.imageUrl as string) ??
        (line.item?.img as string) ??
        (line.item?.photo as string);
      const category: string | undefined =
        (line.category as string) ?? (line.item?.category as string);

      // Pricing snapshot — prefer explicit per-KG price
      const pricePerUnit: number =
        Number(line.unitPriceUsd ?? NaN) ||
        Number(line.pricePerUnit ?? NaN) ||
        Number(line.pricePerKg ?? NaN) ||
        Number(line.item?.pricePerUnit ?? NaN) ||
        0;

      // Unit mode + quantities
      const unitMode: UnitMode | undefined =
        (line.unitMode as UnitMode | undefined) ??
        (line.item?.unitMode as UnitMode | undefined);

      const quantityKg: number | undefined =
        (line.quantityKg as number | undefined) ??
        (line.item?.originalCommittedQuantityKg as number | undefined);

      const units: number | undefined =
        (line.units as number | undefined) ??
        (line.quantity as number | undefined);

      // Estimates snapshot
      const estimatesSnapshot =
        (line as any).estimatesSnapshot ??
        line.item?.estimatesSnapshot ??
        (line.avgWeightPerUnitKg
          ? { avgWeightPerUnitKg: Number(line.avgWeightPerUnitKg) || undefined }
          : undefined);

      // Legacy fallback: older cart lines used `quantity` as pure KG
      const legacyQtyKg = Number(line.quantity ?? NaN);
      const hasLegacyKg =
        !unitMode &&
        !quantityKg &&
        Number.isFinite(legacyQtyKg) &&
        legacyQtyKg > 0;

      return {
        itemId: String(itemId),
        pricePerUnit, // per KG by backend definition
        unitMode: unitMode ?? "kg",
        quantityKg:
          unitMode === "kg" || hasLegacyKg
            ? (quantityKg ?? legacyQtyKg)
            : quantityKg,
        units: unitMode === "unit" || unitMode === "mixed" ? units : undefined,
        estimatesSnapshot,
        name,
        imageUrl,
        category,
        // optional provenance passthrough
        sourceFarmerName:
          (line as any).sourceFarmerName ?? line.item?.farmerName,
        sourceFarmName: (line as any).sourceFarmName ?? line.item?.farmName,
        farmerOrderId: (line as any).farmerOrderId,
      };
    },
    []
  );

  const orderItems = useMemo<CreateOrderItemInput[]>(() => {
    return (deps.cartLines ?? []).map(mapCartLineToOrderItem).filter((it) => {
      // drop invalids defensively
      return (
        !!it.itemId &&
        (Number(it.quantityKg ?? 0) > 0 || Number(it.units ?? 0) > 0)
      );
    });
  }, [deps.cartLines, mapCartLineToOrderItem]);

  /* ------------------------------- Validation ------------------------------ */

  const canSubmit = useMemo(() => {
    const { context } = deps;
    if (!context?.amsId) return false;
    if (!context?.logisticsCenterId) return false;
    if (!context?.deliveryDate) return false;
    if (!context?.shiftName) return false;

    // address is optional in the new flow; require only if you truly need it
    // if (!context?.address) return false;

    if (!orderItems.length) return false;

    if (method === "card") return cardValid;
    if (method === "google_pay") return true;
    if (method === "paypal") return true;
    return false;
  }, [deps, orderItems.length, method, cardValid]);

  /* --------------------------------- Submit -------------------------------- */

  const submit = useCallback(async () => {
    if (!canSubmit) {
      toaster.create({
        title: "Please fix missing details",
        description:
          "Make sure AMS, logistics center, date, shift, and cart items are present.",
        type: "warning",
      });
      return;
    }

    const { context } = deps;

    // Build CreateOrderBody per your backend contract
    const body: CreateOrderBody = {
      amsId: context.amsId as string,
      LogisticsCenterId: context.logisticsCenterId as string, // ✅ match the type's key
      deliveryDate: context.deliveryDate as string,
      shiftName: context.shiftName as string,
      items: orderItems,
      ...(context.address ? { deliveryAddress: context.address as any } : {}),
    } as CreateOrderBody;

    try {
      setSubmitting(true);
      const order = await createOrder(body);
      toaster.create({
        title: "Order placed",
        description: `Order #${order?._id ?? ""} created successfully.`,
        type: "success",
      });
      deps.onSuccess?.(order?._id ?? "");
      return order;
    } catch (e: any) {
      toaster.create({
        title: e?.message ?? "Order failed",
        description:
          (Array.isArray(e?.details) && e.details.map(String).join(", ")) ||
          (typeof e?.details === "string" ? e.details : undefined),
        type: "error",
      });
      throw e;
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, deps, orderItems]);

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
