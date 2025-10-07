// src/pages/checkout/hooks/usePayment.ts
import { useCallback, useMemo, useState } from "react";
import { toaster } from "@/components/ui/toaster";
import type { CreateOrderBody, PaymentMethod, CreateOrderItemInput } from "@/types/orders";
import { createOrder } from "@/api/orders";

type CardState = {
  holder: string;
  cardNumber: string;
  expMonth: string; // keep as string for inputs; validate/convert on submit
  expYear: string;
  cvc: string;
};

export function usePayment(deps: {
  // what we need to build the CreateOrderBody
  context: {
    amsId: string | null;
    logisticsCenterId: string | null;
    deliveryDate: string | null;
    shiftName: string | null;
    deliveryAddress: any | null;
  };
  items: CreateOrderItemInput[]; // from "@/types/order"
  totals: {
    itemsSubtotal: number;
    deliveryFee: number;
    taxUsd: number;
    totalPrice: number;
  };
  onSuccess?: (orderId: string) => void;
}) {
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
    (k: keyof CardState, v: string) => setCard((s) => ({ ...s, [k]: v })),
    []
  );

  // Very light validation; real validation can be added later or delegated to a payment SDK
  const cardValid = useMemo(() => {
    if (method !== "card") return true;
    const month = Number(card.expMonth);
    const year = Number(card.expYear);
    return (
      card.holder.trim().length >= 2 &&
      /^\d{12,19}$/.test(card.cardNumber.replace(/\s+/g, "")) &&
      month >= 1 &&
      month <= 12 &&
      year >= new Date().getFullYear() &&
      /^\d{3,4}$/.test(card.cvc)
    );
  }, [method, card]);

  const canSubmit = useMemo(() => {
    if (!deps?.context?.amsId) return false;
    if (!deps?.context?.logisticsCenterId) return false;
    if (!deps?.context?.deliveryDate) return false;
    if (!deps?.context?.shiftName) return false;
    if (!deps?.context?.deliveryAddress) return false;
    if (!deps?.items?.length) return false;

    if (method === "card") return cardValid;
    if (method === "google_pay") return true; // will be controlled by wallet SDK
    if (method === "paypal") return true; // will be controlled by PayPal SDK
    return false;
  }, [deps, method, cardValid]);

  const submit = useCallback(async () => {
    if (!canSubmit) {
      toaster.create({
        title: "Fix the highlighted fields",
        type: "warning",
      });
      return;
    }

    // Build CreateOrderBody according to your Swagger shape
    const body: CreateOrderBody = {
      amsId: deps.context.amsId!,
      // The API expects lowercase `logisticsCenterId` (Swagger),
      // but our types allow either; send lowercase.
      LogisticsCenterId: undefined as any, // keep undefined; the API client normalizes to lowercase field name
      deliveryDate: deps.context.deliveryDate!,
      deliveryAddress: deps.context.deliveryAddress!,
      shiftName: deps.context.shiftName!,
      items: deps.items as any, // already in CreateOrderItemInput shape
      // tolerancePct: optional
    } as any;

    // Attach the lower-case key here for clarity (the api client also normalizes)
    (body as any).logisticsCenterId = deps.context.logisticsCenterId!;

    // Note: totals are server-verified; we don’t need to send them unless your backend accepts them.
    // If you do want to send a client-estimated summary, you could append them to body.

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
  }, [canSubmit, deps]);

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
