import { memo, useMemo } from "react";
import {
    Box,
    HStack,
    VStack,
    Text,
    Badge,
    Avatar,
    IconButton,
    Link,
    Skeleton,
    Separator,
    Alert,
    Icon,
} from "@chakra-ui/react";
import { FiPhone, FiMail, FiExternalLink, FiMapPin } from "react-icons/fi";
import type { FarmerDetail } from "@/types/farmer";
import { useContactInfo } from "../hooks/useContactInfo";

export type FarmerContactPaneProps = {
    farmer?: FarmerDetail | null;
    isLoading?: boolean; // loading of farmer itself (so we can show unified skeleton)
};

export const FarmerContactPane = memo(function FarmerContactPane({
    farmer,
    isLoading = false,
}: FarmerContactPaneProps) {
    const userId = farmer?.user;
    const {
        contact,
        emailHref,
        telHref,
        hasEmail,
        hasPhone,
        hasLogisticCenter,
        isLoading: isLoadingContact,
        isFetching,
        isError,
        error,
        refetch,
    } = useContactInfo({ userId, enabled: Boolean(userId) });

    const loading = isLoading || isLoadingContact || isFetching;

    const initials = useMemo(() => {
        const n = contact?.name ?? farmer?.farmName ?? "";
        const parts = n.trim().split(/\s+/);
        const [a, b] = [parts[0]?.[0], parts[1]?.[0]];
        return [a, b].filter(Boolean).join("").toUpperCase();
    }, [contact?.name, farmer?.farmName]);

    if (!farmer && !loading) {
        return (
            <Alert.Root status="info" variant="subtle" borderRadius="lg">
                <Alert.Indicator />
                <Alert.Title>No data</Alert.Title>
                <Alert.Description>Farmer details are not loaded yet.</Alert.Description>
            </Alert.Root>
        );
    }

    return (
        <VStack align="stretch" gap={4}>
            {/* Header: Avatar + Names */}
            <HStack gap={3} align="center">
                {loading ? (
                    <Skeleton borderRadius="full" boxSize="48px" />
                ) : (
                    <Avatar.Root size="lg">
                        <Avatar.Image src={contact?.farmLogo ?? farmer?.farmLogo ?? undefined} />
                        <Avatar.Fallback name={contact?.name ?? "F"} />
                    </Avatar.Root>
                )}
                <VStack align="start" gap={0}>
                    {loading ? (
                        <>
                            <Skeleton height="16px" width="180px" />
                            <Skeleton height="14px" width="140px" />
                        </>
                    ) : (
                        <>
                            <Text fontSize="lg" fontWeight="semibold">
                                {contact?.name ?? "—"}
                            </Text>
                            <Text color="fg.subtle">
                                {contact?.farmName ?? farmer?.farmName ?? "—"}
                            </Text>
                        </>
                    )}
                </VStack>
            </HStack>

            <Separator />

            {/* Contact rows */}
            <VStack align="stretch" gap={3}>
                {/* Phone */}
                <HStack gap={3} align="center">
                    <Icon as={FiPhone} color="fg.subtle" />
                    {loading ? (
                        <Skeleton height="14px" width="200px" />
                    ) : hasPhone ? (
                        <Link href={telHref} color="blue.500">
                            {contact?.phone}
                        </Link>
                    ) : (
                        <Text color="fg.subtle">No phone</Text>
                    )}
                </HStack>

                {/* Email */}
                <HStack gap={3} align="center">
                    <Icon as={FiMail} color="fg.subtle" />
                    {loading ? (
                        <Skeleton height="14px" width="240px" />
                    ) : hasEmail ? (
                        <Link href={emailHref} color="blue.500">
                            {contact?.email}
                        </Link>
                    ) : (
                        <Text color="fg.subtle">No email</Text>
                    )}
                </HStack>

                {/* Logistic Center */}
                <HStack gap={3} align="center">
                    <Icon as={FiMapPin} color="fg.subtle" />
                    {loading ? (
                        <Skeleton height="14px" width="160px" />
                    ) : hasLogisticCenter ? (
                        <Badge variant="surface" colorPalette="purple">
                            LC: {contact?.logisticCenterId}
                        </Badge>
                    ) : (
                        <Text color="fg.subtle">No logistic center on record</Text>
                    )}
                </HStack>
            </VStack>

            {/* Footer actions */}
            {!loading && isError && (
                <Alert.Root status="error" borderRadius="lg">
                    <Alert.Indicator />
                    <VStack align="start" gap={1}>
                        <Alert.Title>Failed to load contact</Alert.Title>
                        <Alert.Description>
                            {(error as any)?.message ?? "Unknown error"}
                        </Alert.Description>
                        <IconButton aria-label="Retry" size="sm" variant="subtle" onClick={() => refetch()}>
                            <FiExternalLink />
                        </IconButton>
                    </VStack>
                </Alert.Root>
            )}
        </VStack>
    );
});

export default FarmerContactPane;
