import { memo, useMemo } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    HStack,
    Icon,
    List,
    Stack,
    Tag,
    Text,
} from "@chakra-ui/react";
import {
    FiAlertTriangle,
    FiCalendar,
    FiClock,
    FiHome,
    FiMapPin,
    FiShoppingBag,
    FiArrowLeft,
    FiEdit2,
    FiTruck,
} from "react-icons/fi";
import type { Address } from "@/types/address";
import type { PreflightState } from "../hooks/useCheckoutState";

export type PreflightGuardProps = {
    preflight: PreflightState;

    /** Optional current context to display (nice UX but not required) */
    context?: {
        amsId?: string | null;
        logisticsCenterId?: string | null;
        deliveryDate?: string | null;
        shiftName?: string | null;
        deliveryAddress?: Address | null;
    };

    /** Called to take the user back to Market (fix cart, pickers, etc.) */
    onBackToMarket?: () => void;

    /** Called to open your address/shift picker (drawer or route) */
    onEditAddressShift?: () => void;

    /** What to render if all checks pass */
    children?: React.ReactNode;
};

/** Small helper for safe display */
function fmt(v?: string | null) {
    return v && String(v).trim() ? String(v) : "—";
}

export const PreflightGuard = memo(function PreflightGuard({
    preflight,
    context,
    onBackToMarket,
    onEditAddressShift,
    children,
}: PreflightGuardProps) {
    const allGood = preflight?.allGood === true;

    const rows = useMemo(
        () => [
            {
                key: "cart",
                label: "Cart has items",
                ok: preflight.cartNotEmpty,
                icon: FiShoppingBag,
                hint: preflight.cartNotEmpty ? undefined : "Your cart is empty.",
            },
            {
                key: "address",
                label: "Delivery address selected",
                ok: preflight.hasAddress,
                icon: FiHome,
                hint: preflight.hasAddress ? undefined : "Pick an address on the Market page.",
            },
            {
                key: "date",
                label: "Delivery date selected",
                ok: preflight.hasDeliveryDate,
                icon: FiCalendar,
                hint: preflight.hasDeliveryDate ? undefined : "Choose a delivery date.",
            },
            {
                key: "shift",
                label: "Shift selected",
                ok: preflight.hasShiftName,
                icon: FiClock,
                hint: preflight.hasShiftName ? undefined : "Choose a delivery shift.",
            },
            {
                key: "ams",
                label: "AMS selected",
                ok: preflight.hasAmsId,
                icon: FiMapPin,
                hint: preflight.hasAmsId ? undefined : "Select an AMS region.",
            },
            {
                key: "lc",
                label: "Logistics center selected",
                ok: preflight.hasLogisticsCenterId,
                icon: FiTruck,
                hint: preflight.hasLogisticsCenterId ? undefined : "Select a logistics center.",
            },
        ],
        [preflight]
    );

    if (allGood) {
        return <>{children}</>;
    }

    return (
        <Stack gap={4}>
            <Alert.Root status="warning" borderRadius="md">
                <HStack align="flex-start" gap={2}>
                    <Icon as={FiAlertTriangle} />
                    <Text>You still need to confirm a few things before checkout.</Text>
                </HStack>
            </Alert.Root>

            <Card.Root>
                <Card.Header pb={2}>
                    <Text fontWeight="semibold">What’s missing</Text>
                </Card.Header>
                <Card.Body pt={0}>
                    <Stack gap={4}>
                        {/* Checklist */}
                        <List.Root gap={3}>
                            {rows.map((r) => (
                                <List.Item key={r.key}>
                                    <HStack justifyContent="space-between" align="flex-start" gap={4}>
                                        <HStack gap={2}>
                                            <Icon as={r.icon} />
                                            <Text>{r.label}</Text>
                                        </HStack>
                                        <HStack gap={2}>
                                            <Tag.Root colorPalette={r.ok ? "green" : "red"}>
                                                {r.ok ? "OK" : "Missing"}
                                            </Tag.Root>
                                        </HStack>
                                    </HStack>
                                    {!r.ok && r.hint && (
                                        <Text color="fg.muted" fontSize="sm" paddingInlineStart="24px">
                                            {r.hint}
                                        </Text>
                                    )}
                                </List.Item>
                            ))}
                        </List.Root>

                        {/* Optional context echo for clarity */}
                        {context && (
                            <Box>
                                <Text fontWeight="semibold" mb={2}>
                                    Current selection
                                </Text>
                                <Stack fontSize="sm" color="fg.muted">
                                    <HStack>
                                        <Icon as={FiHome} />
                                        <Text>{fmt(context.deliveryAddress?.address)}</Text>
                                    </HStack>
                                    <HStack>
                                        <Icon as={FiCalendar} />
                                        <Text>{fmt(context.deliveryDate)}</Text>
                                    </HStack>
                                    <HStack>
                                        <Icon as={FiClock} />
                                        <Text>{fmt(context.shiftName)}</Text>
                                    </HStack>
                                    <HStack>
                                        <Icon as={FiMapPin} />
                                        <Text>
                                            AMS: {fmt(context.amsId)} · LC: {fmt(context.logisticsCenterId)}
                                        </Text>
                                    </HStack>
                                </Stack>
                            </Box>
                        )}

                        {/* Actions */}
                        <HStack justifyContent="space-between">
                            <Button variant="ghost" onClick={onBackToMarket} gap={2}>
                                <Icon as={FiArrowLeft} />
                                Back to Market
                            </Button>
                            <Button onClick={onEditAddressShift} gap={2}>
                                <Icon as={FiEdit2} />
                                Change address / shift
                            </Button>
                        </HStack>
                    </Stack>
                </Card.Body>
            </Card.Root>
        </Stack>
    );
});

export default PreflightGuard;
