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
import type { Address } from "@/types/address";
import type { CreateOrderItemInput } from "@/types/orders";
import { usePayment } from "../hooks/usePayment";

/* ---------------------------------- types --------------------------------- */

export type PaymentSectionProps = {
    // Delivery/order context (already gathered from Market / user)
    context: {
        amsId: string | null;
        logisticsCenterId: string | null;
        deliveryDate: string | null;
        shiftName: string | null;
        deliveryAddress: Address | null;
    };

    // Lines prepared for the API (CreateOrderItemInput[])
    items: CreateOrderItemInput[];

    // Display totals (not sent to API unless you later decide to)
    totals: {
        itemsSubtotal: number;
        deliveryFee: number;
        taxUsd: number;
        totalPrice: number;
    };

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
    const { context, items, totals, onSuccess, onBack } = props;

    const { method, setMethod, card, setCardField, canSubmit, submitting, submit } = usePayment({
        context,
        items,
        totals,
        onSuccess,
    });

    const showCard = method === "card";
    const showGPay = method === "google_pay";
    const showPaypal = method === "paypal";

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

                            {/* v3 RadioGroup uses a slot API */}
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

                        {/* Wallet placeholders (clicking still places the order per current flow) */}
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
                                    <Text>{formatCurrencyUSD(totals.itemsSubtotal)}</Text>
                                </HStack>
                                <HStack justifyContent="space-between">
                                    <Text color="fg.muted">Delivery fee</Text>
                                    <Text>{formatCurrencyUSD(totals.deliveryFee)}</Text>
                                </HStack>
                                <HStack justifyContent="space-between">
                                    <Text color="fg.muted">Tax</Text>
                                    <Text>{formatCurrencyUSD(totals.taxUsd)}</Text>
                                </HStack>
                                <Separator />
                                <HStack justifyContent="space-between">
                                    <Text fontWeight="semibold">Total</Text>
                                    <Text fontWeight="semibold">{formatCurrencyUSD(totals.totalPrice)}</Text>
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
