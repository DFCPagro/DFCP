// src/pages/checkout/index.tsx
import { useCallback, useMemo, useState } from "react";
import { Box, Stack, Heading } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

import { useCheckoutState } from "./hooks/useCheckoutState";
import PreflightGuard from "./components/PreflightGuard";
import CheckoutSummary from "./components/CheckoutSummary";
import PaymentSection from "./components/PaymentSection";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { context, cartLines, totals, preflight, actions } = useCheckoutState();
  console.log("CheckoutPage render", { cartLines });
  const clearCart = actions.clear;
  const [step, setStep] = useState<1 | 2>(1);

  const goToPayment = useCallback(() => setStep(2), []);
  const goBackToSummary = useCallback(() => setStep(1), []);

  const onBackToMarket = useCallback(() => {
    navigate("/market");
  }, [navigate]);

  const onEditAddressShift = useCallback(() => {
    // If you have an address/shift drawer, open it here instead.
    navigate("/market"); // take user back to pick/change address & shift
  }, [navigate]);

  // Optional: precompute a boolean to disable step 2 entry if cart/context changed
  const canProceedToPayment = useMemo(() => preflight.ok, [preflight.ok]);

  const handleOrderSuccess = useCallback(
    (orderId: string) => {
      try {
        clearCart(); // clear local cart after successful creation
      } catch {
        // ignore if already cleared by another tab
      }
      if (orderId) {
        navigate(`/orders/${orderId}`);
      } else {
        navigate(`/orders`);
      }
    },
    [clearCart, navigate]
  );

  return (
    <Box px={{ base: 3, md: 6 }} py={{ base: 4, md: 6 }}>
      <Stack gap={5}>
        <Heading size="lg">Checkout</Heading>

        <PreflightGuard
          preflight={preflight}
          context={context}
          onBackToMarket={onBackToMarket}
          onEditAddressShift={onEditAddressShift}
        >
          {step === 1 && (
            <CheckoutSummary
              cartLines={cartLines}                  // CHANGED: was items
              deliveryAddress={context.address}      // CHANGED: was context.deliveryAddress
              deliveryDate={context.deliveryDate}
              shiftName={context.shiftName}
              amsId={context.amsId}
              logisticsCenterId={context.logisticsCenterId}
              totals={totals}
              onEditAddress={onEditAddressShift}
              onContinue={() => {
                if (canProceedToPayment) goToPayment();
              }}
            />

          )}

          {step === 2 && (
            <PaymentSection
              context={context}
              cartLines={cartLines}
              totals={totals}
              onBack={goBackToSummary}
              onSuccess={handleOrderSuccess}
            />
          )}
        </PreflightGuard>
      </Stack>
    </Box>
  );
}
