import { memo, useMemo } from "react";
import {
    Box,
    HStack,
    VStack,
    Text,
    Badge,
    Avatar,
    IconButton,
    Tabs,
    Separator,
    Dialog,
    Button,
    Skeleton,
    Icon,
} from "@chakra-ui/react";
import { FiX } from "react-icons/fi";
import { useFarmerById } from "../hooks/useFarmerById";
import { FarmerContactPane } from "./FarmerContactPane";
import { FarmerLandsPane } from "./FarmerLandsPane";
import { FarmerWorkHistoryPane } from "./FarmerWorkHistoryPane";
import type { FarmerDetail } from "@/types/farmer";

/* --------------------------------- Props --------------------------------- */

export type FarmerDetailsDialogProps = {
    /** Controlled open/close */
    open: boolean;
    onOpenChange: (open: boolean) => void;

    /** Which farmer to show */
    farmerId?: string | null;

    /** Optional: default tab index (0=Contact, 1=Lands, 2=Work history) */
    defaultTab?: number;
};

/* ------------------------------- Utilities ------------------------------- */

function formatDate(d?: string | Date): string {
    if (!d) return "";
    const dt = typeof d === "string" ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
    }).format(dt);
}

/* -------------------------------- Component ------------------------------ */

export const FarmerDetailsDialog = memo(function FarmerDetailsDialog({
    open,
    onOpenChange,
    farmerId,
    defaultTab = 0,
}: FarmerDetailsDialogProps) {
    const {
        farmer,
        joinedAt,
        landsCount,
        sectionsCount,
        isLoading,
        isFetching,
        isError,
        error,
        refetch,
    } = useFarmerById({ farmerId, enabled: open });

    const loading = isLoading || isFetching;

    // Header avatar + names
    const headerAvatarName = useMemo(() => {
        return farmer?.farmName ?? "";
    }, [farmer?.farmName]);

    const headerAvatarSrc = useMemo(() => {
        return (farmer as FarmerDetail | undefined)?.farmLogo ?? undefined;
    }, [farmer]);

    const headerSubtitle = useMemo(() => {
        const joined = joinedAt ? `Joined ${formatDate(joinedAt)}` : "";
        return joined;
    }, [joinedAt]);

    const tabValues = ["contact", "lands", "history"] as const;
    const initialTab = tabValues[defaultTab] ?? "contact";

    return (
        <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
            <Dialog.Content
                maxW={{ base: "95vw", md: "900px" }}
                // Ensure good spacing and scroll behavior
                p={0}
            >
                <Dialog.Header px={5} py={4}>
                    <HStack justify="space-between" align="center">
                        <HStack gap={3}>
                            {loading ? (
                                <Skeleton borderRadius="full" boxSize="44px" />
                            ) : (
                                <Avatar.Root size="md">
                                    <Avatar.Image src={headerAvatarSrc} />
                                    <Avatar.Fallback name={headerAvatarName} />
                                </Avatar.Root>
                            )}
                            <VStack align="start" gap={0}>
                                {loading ? (
                                    <>
                                        <Skeleton height="16px" width="180px" />
                                        <Skeleton height="12px" width="120px" />
                                    </>
                                ) : (
                                    <>
                                        <Dialog.Title>{farmer?.farmName ?? "Farmer info"}</Dialog.Title>
                                        {headerSubtitle && (
                                            <Text color="fg.subtle" fontSize="sm">
                                                {headerSubtitle}
                                            </Text>
                                        )}
                                    </>
                                )}
                            </VStack>
                        </HStack>
                        <IconButton
                            aria-label="Close"
                            size="sm"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                        >
                            <Icon as={FiX} />
                        </IconButton>
                    </HStack>
                </Dialog.Header>

                <Separator />

                <Dialog.Body px={0} py={0}>
                    {/* Top summary strip */}
                    <Box px={5} py={3}>
                        {loading ? (
                            <HStack gap={3}>
                                <Skeleton height="20px" width="80px" />
                                <Skeleton height="20px" width="80px" />
                            </HStack>
                        ) : (
                            <HStack gap={3} wrap="wrap">
                                <Badge variant="surface" colorPalette="green">
                                    Lands: {landsCount}
                                </Badge>
                                <Badge variant="surface" colorPalette="blue">
                                    Sections: {sectionsCount}
                                </Badge>
                            </HStack>
                        )}
                    </Box>

                    <Tabs.Root defaultValue={initialTab}>
                        <Tabs.List px={5} borderBottomWidth="1px">
                            <Tabs.Trigger value="contact">Contact</Tabs.Trigger>
                            <Tabs.Trigger value="lands">Lands</Tabs.Trigger>
                            <Tabs.Trigger value="history">Work history</Tabs.Trigger>
                        </Tabs.List>

                        <Tabs.Content value="contact" px={5} py={4}>
                            <FarmerContactPane farmer={farmer} isLoading={loading} />
                        </Tabs.Content>
                        <Tabs.Content value="lands" px={5} py={4}>
                            <FarmerLandsPane farmer={farmer} isLoading={loading} />
                        </Tabs.Content>
                        <Tabs.Content value="history" px={5} py={4}>
                            <FarmerWorkHistoryPane farmer={farmer} isLoading={loading} />
                        </Tabs.Content>
                    </Tabs.Root>

                    {/* Error inline (non-blocking) */}
                    {!loading && isError && (
                        <Box px={5} py={3} color="red.500" fontSize="sm">
                            {(error as any)?.message ?? "Failed to load farmer details."}
                        </Box>
                    )}
                </Dialog.Body>

                <Separator />

                <Dialog.Footer px={5} py={3}>
                    <HStack gap={3}>
                        <Button variant="subtle" onClick={() => refetch()} disabled={loading}>
                            Refresh
                        </Button>
                        <Button variant="solid" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                    </HStack>
                </Dialog.Footer>
            </Dialog.Content>
        </Dialog.Root>
    );
});

export default FarmerDetailsDialog;
