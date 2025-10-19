// src/pages/checkout/hooks/usePayment.ts
import { useCallback, useMemo, useState } from "react";
import { toaster } from "@/components/ui/toaster";
import {
  type CreateOrderBody,
  type CreateOrderItemInput,
  type PaymentMethod,
} from "@/types/orders";
import type { UnitMode } from "@/types/market"; // or from orders if you re-export it there
import { createOrder } from "@/api/orders";
import type { Address } from "@/types/address";
import type { CartLine as SharedCartLine } from "@/utils/marketCart.shared";

/* -------------------------------------------------------------------------- */
/* Types expected from the new checkout state                                  */
/* -------------------------------------------------------------------------- */

export type CheckoutContext = {
  amsId: string | null;
  logisticsCenterId: string | null;
  deliveryDate: string | null; // ISO yyyy-mm-dd
  shiftName: string | null;
  /** selected delivery address (typed) */
  address: Address | null;
};

export type MoneyTotals = {
  itemCount: number;
  subtotal: number;
};

export function usePayment(deps: {
  context: CheckoutContext;
  cartLines: SharedCartLine[];
  totals: MoneyTotals; // server is still source of truth
  onSuccess?: (orderId: string) => void;
}) {
  /* -------------------------------- UI state ------------------------------- */
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [submitting, setSubmitting] = useState(false);

  type CardState = {
    holder: string;
    cardNumber: string;
    expMonth: string; // keep as string for inputs/selects; validate/convert on submit
    expYear: string; // "YY" two digits (dropdown)
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

  /* ------------------------------ Card validation ------------------------------ */
  const isMonthInRange = (mm: string): boolean => {
    if (!/^\d{2}$/.test(mm)) return false;
    const n = Number(mm);
    return n >= 1 && n <= 12;
  };

  const isYearInWindow = (yy: string, now = new Date()): boolean => {
    if (!/^\d{2}$/.test(yy)) return false;
    const currentFull = now.getFullYear();
    const asFull = (two: number) => 2000 + two; // our YY is 20xx
    const yyNum = Number(yy);
    return asFull(yyNum) >= currentFull && asFull(yyNum) <= currentFull + 20;
  };

  const isExpiryValid = (mm: string, yy: string, now = new Date()): boolean => {
    if (!isMonthInRange(mm) || !isYearInWindow(yy, now)) return false;

    const currentFull = now.getFullYear();
    const currentYY = currentFull % 100; // e.g., 25
    const currentMM = now.getMonth() + 1; // 1..12

    const m = Number(mm);
    const y = Number(yy);

    // valid if year is greater, or same year and month >= current month
    return y > currentYY || (y === currentYY && m >= currentMM);
  };

  const cardValid = useMemo(() => {
    if (method !== "card") return true;

    const digitsOnly = card.cardNumber.replace(/\D+/g, "");
    const monthOk = isMonthInRange(card.expMonth);
    const yearOk = isYearInWindow(card.expYear);
    const expiryOk = isExpiryValid(card.expMonth, card.expYear);

    return (
      card.holder.trim().length >= 2 &&
      /^\d{12,19}$/.test(digitsOnly) && // allow 12–19 digits
      monthOk &&
      yearOk &&
      expiryOk &&
      /^\d{3,4}$/.test(card.cvc)
    );
  }, [method, card]);

  /* ---------------------------- Mapping (cart → order) ---------------------------- */

  const mapCartLineToOrderItem = useCallback(
    (line: SharedCartLine): CreateOrderItemInput => {
      console.log("Mapping cart line to order item", line);
      // Identity
      const itemId: string = line.itemId as string;

      // Display
      const name: string | undefined = line.name as string;

      const imageUrl: string | undefined = line.imageUrl as string;

      const category: string | undefined =
        (line.category as string) ?? (line as any).item?.category;

      // Pricing snapshot — prefer cart snapshot; backend interprets as per KG
      const pricePerUnit: number = Number(line.pricePerUnit ?? NaN);

      // Unit mode + quantities
      const unitMode: UnitMode | undefined = line.unitMode as
        | UnitMode
        | undefined;

      const quantityKg: number | undefined = (line.quantity *
        line.avgWeightPerUnitKg) as number | undefined;

      const units: number | undefined =
        ((line as any).units as number | undefined) ??
        (line.quantity as number | undefined);

      //error here TODO
      // Estimates snapshot
      const estimatesSnapshot =
        (line as any).estimatesSnapshot ??
        (line as any).item?.estimatesSnapshot ??
        (line.avgWeightPerUnitKg
          ? { avgWeightPerUnitKg: Number(line.avgWeightPerUnitKg) || undefined }
          : undefined);

      // Legacy fallback: older cart lines used `quantity` as pure KG

      return {
        itemId: String(itemId),
        pricePerUnit,
        unitMode: unitMode ?? "kg",
        quantityKg,
        units: unitMode === "unit" || unitMode === "mixed" ? units : undefined,
        estimatesSnapshot,
        name,
        imageUrl,
        category,
        // provenance passthrough (prefer cart fields)
        sourceFarmerName: (line as any).sourceFarmerName,
        sourceFarmName: (line as any).sourceFarmName,
        farmerOrderId: (line as any).farmerOrderId,
      };
    },
    []
  );

  const orderItems = useMemo<CreateOrderItemInput[]>(() => {
    return (deps.cartLines ?? []).map(mapCartLineToOrderItem).filter((it) => {
      return (
        !!it.itemId &&
        (Number(it.quantityKg ?? 0) > 0 || Number(it.units ?? 0) > 0)
      );
    });
  }, [deps.cartLines, mapCartLineToOrderItem]);

  /* --------------- Backend expects legacy item shape → build it here --------------- */

  type LegacyOrderItem = {
    itemId: string;
    name: string;
    imageUrl?: string;
    pricePerUnit: number;
    category?: string;
    sourceFarmerName: string;
    sourceFarmName: string;
    farmerOrderId: string;
    quantity: number; // kg
  };

  function mapToLegacyItems(items: CreateOrderItemInput[]): LegacyOrderItem[] {
    const acc = new Map<string, LegacyOrderItem>();

    items.forEach((i, idx) => {
      // quantity in KG
      let quantity = 0;
      if (i.unitMode === "kg") {
        quantity = Number(i.quantityKg ?? 0);
      } else {
        const avg = Number(
          (i as any).avgWeightPerUnitKg ??
            i.estimatesSnapshot?.avgWeightPerUnitKg ??
            0
        );
        const units = Number(i.units ?? 0);
        quantity = units * avg;
      }

      if (!i.itemId) throw new Error(`Item #${idx + 1} is missing itemId`);
      if (!(quantity > 0))
        throw new Error(
          `Item "${i.name ?? i.itemId}" has non-positive quantity`
        );
      if (!(i.pricePerUnit > 0))
        throw new Error(
          `Item "${i.name ?? i.itemId}" has invalid pricePerUnit`
        );

      // required provenance (now filled by the mapper above)
      const farmerOrderId = String(
        (i as any).farmerOrderId ??
          (i as any).source?.farmerOrderId ??
          (i as any).item?.farmerOrderId ??
          ""
      ).trim();

      const sourceFarmerName = String(
        (i as any).sourceFarmerName ??
          (i as any).farmerName ??
          (i as any).item?.farmerName ??
          ""
      ).trim();

      const sourceFarmName = String(
        (i as any).sourceFarmName ??
          (i as any).farmName ??
          (i as any).item?.farmName ??
          ""
      ).trim();

      if (!farmerOrderId)
        throw new Error(
          `Item "${i.name ?? i.itemId}" is missing farmerOrderId`
        );
      if (!sourceFarmerName)
        throw new Error(
          `Item "${i.name ?? i.itemId}" is missing sourceFarmerName`
        );
      if (!sourceFarmName)
        throw new Error(
          `Item "${i.name ?? i.itemId}" is missing sourceFarmName`
        );

      const base: LegacyOrderItem = {
        itemId: String(i.itemId),
        name: String(i.name ?? ""),
        imageUrl: i.imageUrl ? String(i.imageUrl) : undefined,
        pricePerUnit: Number(i.pricePerUnit),
        category: i.category ? String(i.category) : undefined,
        sourceFarmerName,
        sourceFarmName,
        farmerOrderId,
        quantity,
      };

      const key = `${base.farmerOrderId}::${base.itemId}::${base.pricePerUnit}`;
      const existing = acc.get(key);
      if (existing) {
        existing.quantity += base.quantity;
      } else {
        acc.set(key, base);
      }
    });

    return Array.from(acc.values());
  }

  /* ------------------------------- Validation ------------------------------ */

  const canSubmit = useMemo(() => {
    const { context } = deps;
    if (!context?.amsId) return false;
    if (!context?.logisticsCenterId) return false;
    if (!context?.deliveryDate) return false;
    if (!context?.shiftName) return false;
    if (!context?.address) return false;

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
          "Make sure AMS, logistics center, date, shift, address, and cart items are present.",
        type: "warning",
      });
      return;
    }

    const { context } = deps;

    let legacyItems: ReturnType<typeof mapToLegacyItems>;
    try {
      legacyItems = mapToLegacyItems(orderItems);
    } catch (e: any) {
      toaster.create({
        title: "Invalid cart item",
        description: e?.message ?? "Please review quantities and prices.",
        type: "warning",
      });
      return;
    }

    const body = {
      amsId: context.amsId as string,
      // rename to "logisticsCenterId" here if your backend expects lower-case
      LogisticsCenterId: context.logisticsCenterId as string,
      deliveryDate: context.deliveryDate as string,
      shiftName: context.shiftName as string,
      items: legacyItems,
      deliveryAddress: context.address!,
    };
    /*
    "unitMode": "mixed",
      "quantityKg": 2,
      "units": 3,
      "estimatesSnapshot": {
        "avgWeightPerUnitKg": 0.35
    */
    console.log("Submitting order", body);

    try {
      setSubmitting(true);
      const order = await createOrder(body as unknown as CreateOrderBody);
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
