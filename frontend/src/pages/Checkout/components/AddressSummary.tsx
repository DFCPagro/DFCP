import { memo } from "react";
import { Box, Button, Card, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { FiCalendar, FiClock, FiHome, FiMapPin, FiEdit2, FiTruck } from "react-icons/fi";
import type { Address } from "@/types/address";

export type AddressSummaryProps = {
    /** Selected delivery address (from Market pickers) */
    address: Address | null;

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
    const rows = (
        <Stack gap={3}>
            <HStack gap={3}>
                <Icon as={FiHome} />
                <Box flex="1">
                    <Text fontSize="sm" color="fg.muted">
                        Address
                    </Text>
                    <Text>{fmt(address?.address)}</Text>
                    {address?.logisticCenterId && (
                        <Text fontSize="sm" color="fg.muted">
                            LC: {fmt(address.logisticCenterId)}
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

            {logisticsCenterId &&
                address?.logisticCenterId &&
                logisticsCenterId !== address.logisticCenterId && (
                    <HStack gap={3}>
                        <Icon as={FiTruck} />
                        <Box flex="1">
                            <Text fontSize="sm" color="fg.muted">
                                Note
                            </Text>
                            <Text>
                                Using LC: {fmt(logisticsCenterId)} (address LC is {fmt(address.logisticCenterId)})
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
