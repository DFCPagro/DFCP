// src/pages/checkout/components/AddressSummary.tsx
import { memo } from "react";
import { Box, Button, Card, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { FiCalendar, FiClock, FiHome, FiMapPin, FiEdit2, FiTruck } from "react-icons/fi";
import type { Address } from "@/types/address";

export type AddressSummaryProps = {
    /** Selected delivery address (can be a string or object) */
    address: Address | string | Record<string, any> | null;

    /** ISO yyyy-mm-dd */
    deliveryDate: string | null;

    /** e.g., "morning" */
    shiftName: string | null;

    /** Region / AMS id (optional display) */
    amsId?: string | null;

    /** Logistics Center id (optional display) */
    logisticsCenterId?: string | null;

    /** When provided, shows a "Change" button */
    onEdit?: () => void;

    /**
     * Presentation:
     *  - "card" (default): wrapped in Card with header + optional Change button
     *  - "inline": just the rows (parent provides container)
     */
    variant?: "card" | "inline";

    /** Header title when variant="card" */
    title?: string;
};

/* ------------------------------ helpers ------------------------------ */

function fmt(v?: string | null) {
    return v && String(v).trim() ? String(v) : "—";
}

function formatDate(iso: string | null) {
    if (!iso) return "—";
    try {
        const d = new Date(iso);
        return d.toLocaleDateString();
    } catch {
        return iso;
    }
}

/** Be tolerant to multiple address shapes */
function formatAddress(a: Address | string | Record<string, any> | null): string {
    if (!a) return "—";
    if (typeof a === "string") return a || "—";

    const tryKeys = [
        "address",
        "fullAddress",
        "formatted",
        "label",
        "line1", // common line field
    ];

    for (const k of tryKeys) {
        const v = (a as any)?.[k];
        if (v && String(v).trim()) return String(v);
    }

    // Compose from parts if available
    const parts = [
        (a as any)?.line1,
        (a as any)?.line2,
        (a as any)?.city,
        (a as any)?.state,
        (a as any)?.postalCode,
        (a as any)?.country,
    ]
        .filter(Boolean)
        .map(String)
        .join(", ")
        .trim();

    return parts || "—";
}

/* ------------------------------ component ----------------------------- */

export const AddressSummary = memo(function AddressSummary({
    address,
    deliveryDate,
    shiftName,
    amsId,
    logisticsCenterId,
    onEdit,
    variant = "card",
    title = "Delivery details",
}: AddressSummaryProps) {
    const addressText = formatAddress(address);
    console.log("AddressSummary render", { address, addressText });

    // Normalize possible LC key on the address object
    const addressLc =
        (address as any)?.logisticsCenterId ?? (address as any)?.logisticCenterId ?? null;

    const rows = (
        <Stack gap={3}>
            <HStack gap={3}>
                <Icon as={FiHome} />
                <Box flex="1">
                    <Text fontSize="sm" color="fg.muted">
                        Address
                    </Text>
                    <Text>{addressText}</Text>
                    {addressLc && (
                        <Text fontSize="sm" color="fg.muted">
                            LC (from address): {fmt(String(addressLc))}
                        </Text>
                    )}
                </Box>
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
                    <Text>{fmt(shiftName)}</Text>
                </Box>
            </HStack>

            {(amsId || logisticsCenterId) && (
                <HStack gap={3}>
                    <Icon as={FiMapPin} />
                    <Box flex="1">
                        <Text fontSize="sm" color="fg.muted">
                            Region / Center
                        </Text>
                        <Text>
                            AMS: {fmt(amsId)} · LC: {fmt(logisticsCenterId)}
                        </Text>
                    </Box>
                </HStack>
            )}

            {logisticsCenterId && addressLc && logisticsCenterId !== String(addressLc) && (
                <HStack gap={3}>
                    <Icon as={FiTruck} />
                    <Box flex="1">
                        <Text fontSize="sm" color="fg.muted">
                            Note
                        </Text>
                        <Text>
                            Using LC: {fmt(logisticsCenterId)} (address LC is {fmt(String(addressLc))})
                        </Text>
                    </Box>
                </HStack>
            )}
        </Stack>
    );

    if (variant === "inline") return rows;

    return (
        <Card.Root>
            <Card.Header pb={2}>
                <HStack justifyContent="space-between" alignItems="center">
                    <Text fontWeight="semibold">{title}</Text>
                    {onEdit && (
                        <Button size="sm" variant="outline" onClick={onEdit} gap={2}>
                            <Icon as={FiEdit2} />
                            Change
                        </Button>
                    )}
                </HStack>
            </Card.Header>
            <Card.Body pt={0}>{rows}</Card.Body>
        </Card.Root>
    );
});

export default AddressSummary;
