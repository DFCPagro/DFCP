import { memo, useEffect } from "react";
import {
    Box,
    Button,
    Card,
    HStack,
    Icon,
    Separator,
    Stack,
    Text,
} from "@chakra-ui/react";
import {
    FiArrowLeft,
    FiCheck,
    FiCreditCard,
    FiDollarSign,
    FiSmartphone,
} from "react-icons/fi";
import { usePayment } from "../hooks/usePayment";
import CardForm from "./CardForm";
import { type Address } from "@/types/address";
import type { CartLine as SharedCartLine } from "@/utils/market/marketCart.shared";

/* ---------------------------------- types --------------------------------- */

export type MoneyTotals = {
    itemCount: number;
    subtotal: number;
};

export type CheckoutContext = {
    /** Region / AMS id */
    amsId: string | null;
    /** Logistics center id */
    logisticsCenterId: string | null;
    /** ISO yyyy-mm-dd */
    deliveryDate: string | null;
    /** e.g., "morning" | "afternoon" | "night" */
    shiftName: string | null;

    /** Optional: if you later resolve the human labels, keep placeholders here */
    amsLabel?: string | null;
    logisticsCenterLabel?: string | null;

    /** Optional address object if you decide to resolve it in Checkout */
    address: Address | null;
};

export type PaymentSectionProps = {
    // Delivery/order context (URL-driven)
    context: CheckoutContext;

    // Lines from shared cart
    cartLines: SharedCartLine[];

    // Display totals (server is source of truth; we just show a preview)
    totals: MoneyTotals;

    // Callbacks
    onSuccess?: () => void; // navigate away, clear cart, etc.
    onBack?: () => void; // return to summary step
};

/* --------------------------------- helpers -------------------------------- */

function formatCurrencyUSD(n: number | undefined | null): string {
    const v = Number(n ?? 0);
    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
    }).format(Number.isFinite(v) ? v : 0);
}

/* -------------------------------- component -------------------------------- */

export const PaymentSection = memo(function PaymentSection(
    props: PaymentSectionProps,
) {
    const { context, cartLines, totals, onSuccess, onBack } = props;

    const { method, setMethod, card, setCardField, canSubmit, submitting, submit } =
        usePayment({
            context,
            cartLines,
            onSuccess,
        });

    // Ensure "card" is the default selection on first render.
    useEffect(() => {
        if (!method) setMethod("card" as any);
    }, [method, setMethod]);

    const currentMethod = method ?? "card";

    const showCard = currentMethod === "card";
    const showGPay = currentMethod === "google_pay";
    const showPaypal = currentMethod === "paypal";

    // For now, delivery & tax are zero in UI; backend computes final totals.
    let deliveryFee = 5;
    const taxUsd = 0;
    if (totals.subtotal > 100) deliveryFee = 0;
    const totalPrice =
        Math.round((totals.subtotal + deliveryFee + taxUsd) * 100) / 100;

    return (
        <Stack gap={4}>
            <Card.Root>
                <Card.Header pb={2}>
                    <Text fontWeight="semibold">Payment</Text>
                </Card.Header>

                <Card.Body pt={0}>
                    <Stack gap={5}>
                        {/* Method selector */}
                        <Box>
                            <Text fontSize="sm" color="fg.muted" mb={2}>
                                Select payment method
                            </Text>

                            <HStack gap={3} wrap="wrap">
                                <Button
                                    onClick={() => setMethod("card" as any)}
                                    variant={currentMethod === "card" ? "solid" : "outline"}
                                    colorPalette="blue"
                                    gap={2}
                                    aria-pressed={currentMethod === "card"}
                                >
                                    <Icon as={FiCreditCard} />
                                    Credit / Debit card
                                </Button>

                                <Button
                                    onClick={() => setMethod("google_pay" as any)}
                                    variant={currentMethod === "google_pay" ? "solid" : "outline"}
                                    colorPalette="blue"
                                    gap={2}
                                    aria-pressed={currentMethod === "google_pay"}
                                >
                                    <Icon as={FiSmartphone} />
                                    Google&nbsp;Pay
                                </Button>

                                <Button
                                    onClick={() => setMethod("paypal" as any)}
                                    variant={currentMethod === "paypal" ? "solid" : "outline"}
                                    colorPalette="blue"
                                    gap={2}
                                    aria-pressed={currentMethod === "paypal"}
                                >
                                    <Icon as={FiDollarSign} />
                                    PayPal
                                </Button>
                            </HStack>
                        </Box>

                        {/* Card form */}
                        {showCard && (
                            <CardForm
                                value={card}
                                onChange={setCardField}
                                disabled={submitting}
                                errors={
                                    undefined /* or hook-provided error object if you add validation later */
                                }
                            />
                        )}

                        {/* Wallet placeholders (demo) */}
                        {showGPay && (
                            <Box>
                                <Button variant="subtle" onClick={submit} loading={submitting}>
                                    Pay with Google&nbsp;Pay
                                </Button>
                                <Text mt={2} fontSize="sm" color="fg.muted">
                                    (Demo) Wallets aren’t wired yet — we’ll place the order as
                                    normal.
                                </Text>
                            </Box>
                        )}
                        {showPaypal && (
                            <Box>
                                <Button variant="subtle" onClick={submit} loading={submitting}>
                                    Pay with PayPal
                                </Button>
                                <Text mt={2} fontSize="sm" color="fg.muted">
                                    (Demo) Wallets aren’t wired yet — we’ll place the order as
                                    normal.
                                </Text>
                            </Box>
                        )}

                        {/* Totals recap */}
                        <Box>
                            <Separator my={2} />
                            <Stack gap={2}>
                                <HStack justifyContent="space-between">
                                    <Text color="fg.muted">Items subtotal</Text>
                                    <Text>{formatCurrencyUSD(totals.subtotal)}</Text>
                                </HStack>
                                <HStack justifyContent="space-between">
                                    <Text color="fg.muted">Delivery fee</Text>
                                    <Text>{formatCurrencyUSD(deliveryFee)}</Text>
                                </HStack>
                                <HStack justifyContent="space-between">
                                    <Text color="fg.muted">Tax</Text>
                                    <Text>{formatCurrencyUSD(taxUsd)}</Text>
                                </HStack>
                                <Separator />
                                <HStack justifyContent="space-between">
                                    <Text fontWeight="semibold">Total</Text>
                                    <Text fontWeight="semibold">
                                        {formatCurrencyUSD(totalPrice)}
                                    </Text>
                                </HStack>
                            </Stack>
                        </Box>

                        {/* Actions */}
                        <HStack justifyContent="space-between" mt={2}>
                            <Button variant="ghost" onClick={onBack} gap={2}>
                                <Icon as={FiArrowLeft} />
                                Back
                            </Button>

                            <Button
                                colorPalette="green"
                                onClick={submit}
                                disabled={!canSubmit}
                                loading={submitting}
                                gap={2}
                            >
                                Place order
                                <Icon as={FiCheck} />
                            </Button>
                        </HStack>
                    </Stack>
                </Card.Body>
            </Card.Root>
        </Stack>
    );
});

export default PaymentSection;
