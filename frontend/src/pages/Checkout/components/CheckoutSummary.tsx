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
    FiMapPin,
    FiTruck,
    FiChevronRight,
} from "react-icons/fi";

/* ---------------------------------- Types --------------------------------- */

export type CartLineLike = {
    key?: string;
    stockId?: string;

    // identity / display
    name?: string;
    displayName?: string;
    imageUrl?: string;
    category?: string;

    // quantities
    quantity?: number;       // legacy: kg
    quantityKg?: number;     // kg
    units?: number;          // count
    unitMode?: "kg" | "unit" | "mixed";
    estimatesSnapshot?: { avgWeightPerUnitKg?: number };
    avgWeightPerUnitKg?: number;

    // pricing (per KG)
    unitPriceUsd?: number;
    pricePerKg?: number;
    pricePerUnit?: number;

    // nested item (optional, from market)
    item?: any;

    [k: string]: unknown;
};

export type MoneyTotals = {
    itemCount: number;
    subtotal: number;
};

export type CheckoutSummaryProps = {
    // Order lines to confirm (from shared cart)
    cartLines: CartLineLike[];

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

function readPerKgPrice(l: CartLineLike): number {
    return (
        Number(l.unitPriceUsd ?? NaN) ||
        Number(l.pricePerUnit ?? NaN) ||
        Number(l.pricePerKg ?? NaN) ||
        Number(l.item?.pricePerUnit ?? NaN) ||
        0
    );
}

function readDisplayName(l: CartLineLike): string {
    return (
        (l.name as string) ??
        (l.displayName as string) ??
        (l.item?.displayName as string) ??
        (l.item?.name as string) ??
        "Item"
    );
}

function readImageUrl(l: CartLineLike): string | undefined {
    return (
        (l.imageUrl as string | undefined) ??
        (l.item?.imageUrl as string | undefined) ??
        (l.item?.img as string | undefined) ??
        (l.item?.photo as string | undefined)
    );
}

function readCategory(l: CartLineLike): string | undefined {
    return (l.category as string | undefined) ?? (l.item?.category as string | undefined);
}

function readUnitMode(l: CartLineLike): "kg" | "unit" | "mixed" {
    return (l.unitMode as any) ?? (l.item?.unitMode as any) ?? "kg";
}

function readAvgPerUnit(l: CartLineLike): number | undefined {
    return (
        Number(l.estimatesSnapshot?.avgWeightPerUnitKg ?? NaN) ||
        Number(l.avgWeightPerUnitKg ?? NaN) ||
        Number(l.item?.estimatesSnapshot?.avgWeightPerUnitKg ?? NaN) ||
        undefined
    );
}

function computeDisplayQty(l: CartLineLike): { text: string; effKg: number } {
    const mode = readUnitMode(l);
    const avgPerUnit = readAvgPerUnit(l);
    const qtyLegacyKg = Number(l.quantity ?? NaN);
    const qtyKg = Number(l.quantityKg ?? NaN);
    const units = Number(l.units ?? NaN);

    // Legacy fallback: if nothing explicit and legacy quantity present → treat as kg
    const hasLegacyKg =
        !l.unitMode && !l.quantityKg && Number.isFinite(qtyLegacyKg) && qtyLegacyKg > 0;

    if (mode === "kg" || hasLegacyKg) {
        const kg = Number.isFinite(qtyKg) ? qtyKg : qtyLegacyKg || 0;
        return { text: Number.isFinite(kg) ? `${kg} kg` : "—", effKg: Number(kg || 0) };
    }

    if (mode === "unit") {
        if (Number.isFinite(units)) {
            const base = `${units} unit${units === 1 ? "" : "s"}`;
            if (Number.isFinite(avgPerUnit)) {
                return {
                    text: `${base} (~${avgPerUnit} kg/u)`,
                    effKg: units * (avgPerUnit || 0),
                };
            }
            return { text: base, effKg: 0 };
        }
        return { text: "—", effKg: 0 };
    }

    // mixed
    const kgPart = Number.isFinite(qtyKg) ? qtyKg : 0;
    const unitPartKg =
        Number.isFinite(units) && Number.isFinite(avgPerUnit) ? units * (avgPerUnit || 0) : 0;

    const parts: string[] = [];
    if (kgPart > 0) parts.push(`${kgPart} kg`);
    if (Number.isFinite(units)) {
        const unitTxt = `${units} unit${units === 1 ? "" : "s"}`;
        parts.push(Number.isFinite(avgPerUnit) ? `${unitTxt} (~${avgPerUnit} kg/u)` : unitTxt);
    }

    return { text: parts.length ? parts.join(" + ") : "—", effKg: kgPart + unitPartKg };
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
            const price = readPerKgPrice(l);
            const { text: qtyText, effKg } = computeDisplayQty(l);
            const lineTotal = Math.round(price * effKg * 100) / 100;

            return {
                key: String(l.key ?? l.stockId ?? idx),
                name: readDisplayName(l),
                imageUrl: readImageUrl(l),
                category: readCategory(l),
                pricePerKgText: `${formatCurrencyUSD(price)} / kg`,
                qtyText,
                lineTotalText: formatCurrencyUSD(lineTotal),
            };
        });
    }, [cartLines]);

    // delivery & tax zero for now; server is source of truth
    const deliveryFee = 15;
    const taxUsd = 0;
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

                        <HStack gap={3}>
                            <Icon as={FiMapPin} />
                            <Box flex="1">
                                <Text fontSize="sm" color="fg.muted">
                                    Region / Center
                                </Text>
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
