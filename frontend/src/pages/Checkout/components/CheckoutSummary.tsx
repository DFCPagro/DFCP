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
import { FiCalendar, FiClock, FiHome, FiMapPin, FiTruck, FiChevronRight } from "react-icons/fi";
import type { Address } from "@/types/address";
import type { CreateOrderItemInput } from "@/types/orders";

export type CheckoutSummaryProps = {
    // Order lines to confirm
    items: CreateOrderItemInput[];

    // Delivery context
    deliveryAddress: Address | null;
    deliveryDate: string | null; // ISO yyyy-mm-dd
    shiftName: string | null;
    amsId?: string | null;
    logisticsCenterId?: string | null;

    // Totals (pre-tax/fees or post, depending on caller)
    totals: {
        itemsSubtotal: number;
        deliveryFee: number;
        taxUsd: number;
        totalPrice: number;
    };

    // UX
    onContinue?: () => void;
    onEditAddress?: () => void;
    isLoading?: boolean;
};

/* --------------------------------- helpers -------------------------------- */

function formatCurrencyUSD(n: number | undefined | null): string {
    const v = Number(n ?? 0);
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
        Number.isFinite(v) ? v : 0
    );
}

function formatDate(iso: string | null): string {
    if (!iso) return "—";
    try {
        const d = new Date(iso);
        // If only YYYY-MM-DD is provided, Date() will treat as UTC; still fine for display.
        return d.toLocaleDateString();
    } catch {
        return iso;
    }
}

/** Mirror of computeTotals logic: estimated line total in USD */
function computeLineTotalUSD(it: CreateOrderItemInput): number {
    const price = Number(it.pricePerUnit) || 0;

    if (it.unitMode === "unit" && it.units && it.estimatesSnapshot?.avgWeightPerUnitKg) {
        return price * it.units * it.estimatesSnapshot.avgWeightPerUnitKg;
    }
    if ((it.unitMode === "kg" || !it.unitMode) && it.quantityKg) {
        return price * it.quantityKg;
    }
    if (it.unitMode === "mixed") {
        const kgPart = (Number(it.quantityKg) || 0) * price;
        const unitPart =
            (Number(it.units) || 0) * (Number(it.estimatesSnapshot?.avgWeightPerUnitKg) || 0) * price;
        return kgPart + unitPart;
    }
    return 0;
}

function formatQty(it: CreateOrderItemInput): string {
    const parts: string[] = [];
    if (it.unitMode === "kg" || it.unitMode === undefined) {
        if (it.quantityKg) parts.push(`${Number(it.quantityKg)} kg`);
    } else if (it.unitMode === "unit") {
        if (it.units !== undefined) {
            const unitTxt = `${Number(it.units)} unit${Number(it.units) === 1 ? "" : "s"}`;
            if (it.estimatesSnapshot?.avgWeightPerUnitKg)
                parts.push(`${unitTxt} (~${it.estimatesSnapshot.avgWeightPerUnitKg} kg/u)`);
            else parts.push(unitTxt);
        }
    } else if (it.unitMode === "mixed") {
        if (it.quantityKg) parts.push(`${Number(it.quantityKg)} kg`);
        if (it.units !== undefined) {
            const unitTxt = `${Number(it.units)} unit${Number(it.units) === 1 ? "" : "s"}`;
            if (it.estimatesSnapshot?.avgWeightPerUnitKg)
                parts.push(`${unitTxt} (~${it.estimatesSnapshot.avgWeightPerUnitKg} kg/u)`);
            else parts.push(unitTxt);
        }
    }
    return parts.length ? parts.join(" + ") : "—";
}

/* -------------------------------- component -------------------------------- */

export const CheckoutSummary = memo(function CheckoutSummary(props: CheckoutSummaryProps) {
    const {
        items,
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

    const linesVM = useMemo(
        () =>
            (items ?? []).map((it, idx) => {
                const lineTotal = computeLineTotalUSD(it);
                return {
                    key: `${it.itemId}-${idx}`,
                    name: it.name ?? "Item",
                    imageUrl: it.imageUrl,
                    category: it.category,
                    unitMode: it.unitMode ?? "kg",
                    qtyText: formatQty(it),
                    pricePerKgText: `${formatCurrencyUSD(it.pricePerUnit)} / kg`,
                    lineTotalText: formatCurrencyUSD(lineTotal),
                };
            }),
        [items]
    );

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
                                <Text fontSize="sm" color="fg.muted">Address</Text>
                                <Text>
                                    {deliveryAddress?.address ?? "—"}
                                </Text>
                                {deliveryAddress?.logisticCenterId && (
                                    <Text color="fg.muted" fontSize="sm">
                                        LC: {deliveryAddress.logisticCenterId}
                                    </Text>
                                )}
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
                                <Text fontSize="sm" color="fg.muted">Delivery date</Text>
                                <Text>{formatDate(deliveryDate)}</Text>
                            </Box>
                        </HStack>

                        <HStack gap={3}>
                            <Icon as={FiClock} />
                            <Box flex="1">
                                <Text fontSize="sm" color="fg.muted">Shift</Text>
                                <Text>{shiftName ?? "—"}</Text>
                            </Box>
                        </HStack>

                        <HStack gap={3}>
                            <Icon as={FiMapPin} />
                            <Box flex="1">
                                <Text fontSize="sm" color="fg.muted">Region / Center</Text>
                                <Text>
                                    AMS: {amsId ?? "—"} · LC: {logisticsCenterId ?? "—"}
                                </Text>
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
                        {linesVM.length === 0 && (
                            <Text color="fg.muted">Your cart is empty.</Text>
                        )}

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
                                            <Text fontSize="sm" color="fg.muted">{ln.category}</Text>
                                        )}
                                        <Text fontSize="sm" color="fg.muted">{ln.qtyText}</Text>
                                        <Text fontSize="sm" color="fg.muted">{ln.pricePerKgText}</Text>
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
