// src/pages/checkout/components/CheckoutSummary.tsx
import { memo, useMemo } from "react";
import {
    Box,
    Button,
    Card,
    HStack,
    Icon,
    Image,
    Separator,
    Stack,
    Text,
} from "@chakra-ui/react";
import {
    FiCalendar,
    FiClock,
    FiHome,
    FiTruck,
    FiChevronRight,
} from "react-icons/fi";

import type { CartLine as SharedCartLine } from "@/utils/marketCart.shared";

/* ---------------------------------- Types --------------------------------- */

export type MoneyTotals = {
    itemCount: number;
    subtotal: number;
};

export type CheckoutSummaryProps = {
    // Order lines to confirm (from shared cart)
    cartLines: SharedCartLine[];

    // Delivery context
    deliveryAddress?: any | null; // optional now
    deliveryDate: string | null;  // ISO yyyy-mm-dd
    shiftName: string | null;
    amsId?: string | null;
    logisticsCenterId?: string | null;

    // Totals (from useCheckoutState: { itemCount, subtotal })
    totals: MoneyTotals;

    // UX
    onContinue?: () => void;
    onEditAddress?: () => void;
    isLoading?: boolean;
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

function formatDate(iso: string | null): string {
    if (!iso) return "—";
    try {
        const d = new Date(iso);
        return d.toLocaleDateString();
    } catch {
        return iso;
    }
}

/** price per the selected unit (kg or unit), taken from the cart snapshot */
function readUnitPrice(l: SharedCartLine): number {
    return Number(l?.pricePerUnit ?? 0) || 0;
}

function readDisplayName(l: SharedCartLine): string {
    return (l.name as string) || "Item";
}

function readImageUrl(l: SharedCartLine): string | undefined {
    return l.imageUrl || undefined;
}

function readCategory(l: SharedCartLine): string | undefined {
    return l.category || undefined;
}

/** Quantity text and effective kg (for displaying an estimated conversion when unit=unit) */
function computeDisplayQty(l: SharedCartLine): { text: string; effKg?: number } {
    const unit = l.unit === "unit" ? "unit" : "kg";
    const qty = Number(l.quantity ?? 0) || 0;

    if (unit === "kg") {
        return { text: `${qty} kg`, effKg: qty };
    }

    // unit === "unit"
    const base = `${qty} unit${qty === 1 ? "" : "s"}`;
    const avg = typeof l.avgWeightPerUnitKg === "number" ? l.avgWeightPerUnitKg : undefined;
    if (typeof avg === "number") {
        const estKg = Math.round(qty * avg * 100) / 100;
        return { text: `${base} (~${avg} kg/u)`, effKg: estKg };
    }
    return { text: base, effKg: undefined };
}

/** label suffix for price, based on selected unit */
function priceSuffix(l: SharedCartLine): string {
    return l.unit === "unit" ? " / unit" : " / kg";
}

function formatAddress(a: any): string {
    if (!a) return "—";
    if (typeof a === "string") return a || "—";
    const addr = a?.address ?? a?.fullAddress ?? a?.formatted ?? a?.label;
    return (addr && String(addr).trim()) || "—";
}

/* -------------------------------- component -------------------------------- */

export const CheckoutSummary = memo(function CheckoutSummary(props: CheckoutSummaryProps) {
    const {
        cartLines,
        deliveryAddress,
        deliveryDate,
        shiftName,
        amsId,
        logisticsCenterId,
        totals,
        onContinue,
        onEditAddress,
        isLoading,
    } = props;

    const linesVM = useMemo(() => {
        return (cartLines ?? []).map((l, idx) => {
            const price = readUnitPrice(l);
            const { text: qtyText } = computeDisplayQty(l);
            const lineTotal = Math.round(price * (Number(l.quantity ?? 0) || 0) * 100) / 100;

            return {
                key: String(l.key ?? l.stockId ?? l.itemId ?? idx),
                name: readDisplayName(l),
                imageUrl: readImageUrl(l),
                category: readCategory(l),
                unitPriceText: `${formatCurrencyUSD(price)}${priceSuffix(l)}`,
                qtyText,
                lineTotalText: formatCurrencyUSD(lineTotal),
            };
        });
    }, [cartLines]);

    // delivery & tax zero for now; server is source of truth
    let deliveryFee = 5;
    const taxUsd = 0;
    if (totals.subtotal > 100) deliveryFee = 0;
    const totalPrice = Math.round((totals.subtotal + deliveryFee + taxUsd) * 100) / 100;

    return (
        <Stack gap={4}>
            {/* Delivery details */}
            <Card.Root>
                <Card.Header pb={2}>
                    <HStack gap={2}>
                        <Icon as={FiTruck} />
                        <Text fontWeight="semibold">Delivery details</Text>
                    </HStack>
                </Card.Header>
                <Card.Body pt={0}>
                    <Stack gap={3}>
                        <HStack gap={3}>
                            <Icon as={FiHome} />
                            <Box flex="1">
                                <Text fontSize="sm" color="fg.muted">
                                    Address
                                </Text>
                                <Text>{formatAddress(deliveryAddress)}</Text>
                            </Box>
                            {onEditAddress && (
                                <Button size="sm" variant="outline" onClick={onEditAddress}>
                                    Change
                                </Button>
                            )}
                        </HStack>

                        <HStack gap={3}>
                            <Icon as={FiCalendar} />
                            <Box flex="1">
                                <Text fontSize="sm" color="fg.muted">
                                    Delivery date
                                </Text>
                                <Text>{formatDate(deliveryDate)}</Text>
                            </Box>
                        </HStack>

                        <HStack gap={3}>
                            <Icon as={FiClock} />
                            <Box flex="1">
                                <Text fontSize="sm" color="fg.muted">
                                    Shift
                                </Text>
                                <Text>{shiftName ?? "—"}</Text>
                            </Box>
                        </HStack>
                    </Stack>
                </Card.Body>
            </Card.Root>

            {/* Items */}
            <Card.Root>
                <Card.Header pb={2}>
                    <HStack gap={2}>
                        <Icon as={FiTruck} />
                        <Text fontWeight="semibold">Items</Text>
                    </HStack>
                </Card.Header>
                <Card.Body pt={0}>
                    <Stack gap={3}>
                        {linesVM.length === 0 && <Text color="fg.muted">Your cart is empty.</Text>}

                        {linesVM.map((ln, i) => (
                            <Box key={ln.key}>
                                <HStack align="flex-start" gap={3}>
                                    <Image
                                        src={ln.imageUrl}
                                        alt={ln.name}
                                        borderRadius="md"
                                        boxSize="56px"
                                        objectFit="cover"
                                    />
                                    <Box flex="1">
                                        <Text fontWeight="medium">{ln.name}</Text>
                                        {ln.category && (
                                            <Text fontSize="sm" color="fg.muted">
                                                {ln.category}
                                            </Text>
                                        )}
                                        <Text fontSize="sm" color="fg.muted">{ln.qtyText}</Text>
                                        <Text fontSize="sm" color="fg.muted">{ln.unitPriceText}</Text>
                                    </Box>
                                    <Text fontWeight="semibold">{ln.lineTotalText}</Text>
                                </HStack>
                                {i < linesVM.length - 1 && <Separator my={3} />}
                            </Box>
                        ))}
                    </Stack>
                </Card.Body>
            </Card.Root>

            {/* Totals */}
            <Card.Root>
                <Card.Header pb={2}>
                    <Text fontWeight="semibold">Totals</Text>
                </Card.Header>
                <Card.Body pt={0}>
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
                </Card.Body>
            </Card.Root>

            {/* Continue CTA */}
            <Box>
                <Button
                    size="lg"
                    onClick={onContinue}
                    disabled={linesVM.length === 0}
                    loading={!!isLoading}
                    gap={2}
                >
                    Continue to payment
                    <Icon as={FiChevronRight} />
                </Button>
            </Box>
        </Stack>
    );
});

export default CheckoutSummary;
