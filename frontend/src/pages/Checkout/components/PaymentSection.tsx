import { memo } from "react";
import {
    Box,
    Button,
    Card,
    Field,
    HStack,
    Icon,
    Input,
    RadioGroup,
    Separator,
    Stack,
    Text,
} from "@chakra-ui/react";
import { FiArrowLeft, FiCheck, FiCreditCard, FiDollarSign, FiSmartphone } from "react-icons/fi";
import { usePayment } from "../hooks/usePayment";

/* ---------------------------------- types --------------------------------- */

export type CartLineLike = {
    quantity?: number;
    quantityKg?: number;
    units?: number;
    unitMode?: "kg" | "unit" | "mixed";
    unitPriceUsd?: number;
    pricePerUnit?: number;
    pricePerKg?: number;
    estimatesSnapshot?: { avgWeightPerUnitKg?: number };
    avgWeightPerUnitKg?: number;
    item?: any;
    [k: string]: unknown;
};

export type MoneyTotals = {
    itemCount: number;
    subtotal: number;
};

export type PaymentSectionProps = {
    // Delivery/order context (URL-driven)
    context: {
        amsId: string | null;
        logisticsCenterId: string | null;
        deliveryDate: string | null;
        shiftName: string | null;
        /** optional in new flow */
        address?: unknown | null;
    };

    // Lines from shared cart
    cartLines: CartLineLike[];

    // Display totals (server is source of truth; we just show a preview)
    totals: MoneyTotals;

    // Callbacks
    onSuccess?: (orderId: string) => void; // navigate away, clear cart, etc.
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

export const PaymentSection = memo(function PaymentSection(props: PaymentSectionProps) {
    const { context, cartLines, totals, onSuccess, onBack } = props;

    const { method, setMethod, card, setCardField, canSubmit, submitting, submit } = usePayment({
        context,
        cartLines,
        totals,
        onSuccess,
    });

    const showCard = method === "card";
    const showGPay = method === "google_pay";
    const showPaypal = method === "paypal";

    // For now, delivery & tax are zero in UI; backend computes final totals.
    const deliveryFee = 15;
    const taxUsd = 0;
    const totalPrice = Math.round((totals.subtotal + deliveryFee + taxUsd) * 100) / 100;

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

                            <RadioGroup.Root value={method ?? ""} onValueChange={(val: any) => setMethod(val as any)}>
                                <Stack gap={3}>
                                    <RadioGroup.Item value="card">
                                        <RadioGroup.ItemControl />
                                        <RadioGroup.ItemText>
                                            <HStack gap={2}>
                                                <Icon as={FiCreditCard} />
                                                <Text>Credit / Debit card</Text>
                                            </HStack>
                                        </RadioGroup.ItemText>
                                    </RadioGroup.Item>

                                    <RadioGroup.Item value="google_pay">
                                        <RadioGroup.ItemControl />
                                        <RadioGroup.ItemText>
                                            <HStack gap={2}>
                                                <Icon as={FiSmartphone} />
                                                <Text>Google&nbsp;Pay</Text>
                                            </HStack>
                                        </RadioGroup.ItemText>
                                    </RadioGroup.Item>

                                    <RadioGroup.Item value="paypal">
                                        <RadioGroup.ItemControl />
                                        <RadioGroup.ItemText>
                                            <HStack gap={2}>
                                                <Icon as={FiDollarSign} />
                                                <Text>PayPal</Text>
                                            </HStack>
                                        </RadioGroup.ItemText>
                                    </RadioGroup.Item>
                                </Stack>
                            </RadioGroup.Root>
                        </Box>

                        {/* Card form */}
                        {showCard && (
                            <Stack gap={3}>
                                <Field.Root>
                                    <Field.Label>Cardholder name</Field.Label>
                                    <Input
                                        value={card.holder}
                                        onChange={(e) => setCardField("holder", e.target.value)}
                                        placeholder="Full name on card"
                                        autoComplete="cc-name"
                                    />
                                </Field.Root>

                                <Field.Root>
                                    <Field.Label>Card number</Field.Label>
                                    <Input
                                        value={card.cardNumber}
                                        onChange={(e) => {
                                            // Keep digits + spaces; simple inline normalization
                                            const next = e.target.value.replace(/[^\d\s]/g, "");
                                            setCardField("cardNumber", next);
                                        }}
                                        inputMode="numeric"
                                        placeholder="4242 4242 4242 4242"
                                        autoComplete="cc-number"
                                    />
                                </Field.Root>

                                <HStack gap={3}>
                                    <Field.Root>
                                        <Field.Label>Expiry month</Field.Label>
                                        <Input
                                            value={card.expMonth}
                                            onChange={(e) => {
                                                const v = e.target.value.replace(/[^\d]/g, "");
                                                setCardField("expMonth", v.slice(0, 2));
                                            }}
                                            inputMode="numeric"
                                            placeholder="MM"
                                            autoComplete="cc-exp-month"
                                        />
                                    </Field.Root>

                                    <Field.Root>
                                        <Field.Label>Expiry year</Field.Label>
                                        <Input
                                            value={card.expYear}
                                            onChange={(e) => {
                                                const v = e.target.value.replace(/[^\d]/g, "");
                                                setCardField("expYear", v.slice(0, 4));
                                            }}
                                            inputMode="numeric"
                                            placeholder="YYYY"
                                            autoComplete="cc-exp-year"
                                        />
                                    </Field.Root>

                                    <Field.Root>
                                        <Field.Label>CVC</Field.Label>
                                        <Input
                                            value={card.cvc}
                                            onChange={(e) => {
                                                const v = e.target.value.replace(/[^\d]/g, "");
                                                setCardField("cvc", v.slice(0, 4));
                                            }}
                                            inputMode="numeric"
                                            placeholder="CVC"
                                            autoComplete="cc-csc"
                                        />
                                    </Field.Root>
                                </HStack>
                            </Stack>
                        )}

                        {/* Wallet placeholders (demo) */}
                        {showGPay && (
                            <Box>
                                <Button variant="subtle" onClick={submit} loading={submitting}>
                                    Pay with Google&nbsp;Pay
                                </Button>
                                <Text mt={2} fontSize="sm" color="fg.muted">
                                    (Demo) Wallets aren’t wired yet — we’ll place the order as normal.
                                </Text>
                            </Box>
                        )}
                        {showPaypal && (
                            <Box>
                                <Button variant="subtle" onClick={submit} loading={submitting}>
                                    Pay with PayPal
                                </Button>
                                <Text mt={2} fontSize="sm" color="fg.muted">
                                    (Demo) Wallets aren’t wired yet — we’ll place the order as normal.
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
                                    <Text fontWeight="semibold">{formatCurrencyUSD(totalPrice)}</Text>
                                </HStack>
                            </Stack>
                        </Box>

                        {/* Actions */}
                        <HStack justifyContent="space-between" mt={2}>
                            <Button variant="ghost" onClick={onBack} gap={2}>
                                <Icon as={FiArrowLeft} />
                                Back
                            </Button>

                            <Button colorPalette="green" onClick={submit} disabled={!canSubmit} loading={submitting} gap={2}>
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
