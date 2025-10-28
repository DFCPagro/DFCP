// src/pages/CreateStock/components/InitContextBanner.tsx
// Tiny banner that shows the current Create Stock context after init:
// - date · shift
// - AMS id (short)
// - Created/Found chip
// - Loading & error states
//
// Keep this simple and focused. If you later add more AMS context (LC, locks, etc.),
// extend the "details" block.
//
// TODO(real API): You may want to show additional details the init response returns.

import { memo } from "react";
import {
    Box,
    HStack,
    Stack,
    Text,
    Badge,
    Button,
    Skeleton,
} from "@chakra-ui/react";
import type { AsyncStatus, InitResult } from "../types";

export type InitContextBannerProps = {
    status: AsyncStatus;
    data?: InitResult | null;
    error?: string | null;
    onRetry?: () => void;
    onChangeSelection?: () => void; // clears ?date&shift in the page
};

function titleCase(s: string) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function shortId(id?: string | null, take = 6): string {
    if (!id) return "—";
    const tail = id.slice(-take);
    return `…${tail}`;
}

function StateChip(props: { status: AsyncStatus; created?: boolean }) {
    const { status, created } = props;

    if (status === "loading") {
        return <Badge colorPalette="gray">Initializing…</Badge>;
    }
    if (status === "error") {
        return <Badge colorPalette="red">Error</Badge>;
    }
    if (status === "success") {
        return (
            <Badge colorPalette={created ? "green" : "gray"}>
                {created ? "Created" : "Found"}
            </Badge>
        );
    }
    return <Badge colorPalette="gray">Idle</Badge>;
}

function Content({
    status,
    data,
    error,
    onRetry,
    onChangeSelection,
}: InitContextBannerProps) {
    // Loading skeleton layout to keep size stable
    if (status === "loading") {
        return (
            <HStack justify="space-between" w="full">
                <Skeleton h="5" w="40%" />
                <Skeleton h="8" w="160px" />
            </HStack>
        );
    }

    // Error state
    if (status === "error") {
        return (
            <HStack justify="space-between" w="full" align="center">
                <Stack gap="1">
                    <Text fontWeight="medium" color="fg.error">
                        Failed to initialize stock
                    </Text>
                    {error ? (
                        <Text fontSize="sm" color="fg.muted">
                            {error}
                        </Text>
                    ) : null}
                </Stack>
                <HStack>
                    <Button size="sm" colorPalette="gray" onClick={onChangeSelection}>
                        Change selection
                    </Button>
                    <Button size="sm" colorPalette="green" onClick={onRetry}>
                        Retry
                    </Button>
                </HStack>
            </HStack>
        );
    }

    // Success / Idle display
    const date = data?.date ?? "—";
    const shift = data?.shift ? titleCase(String(data.shift)) : "—";
    const amsShort = shortId(data?.amsId);
    const created = data?.created ?? false;

    return (
        <HStack justify="space-between" w="full" align="center">
            <Stack gap="0">
                <HStack gap="2" wrap="wrap">
                    <Text fontWeight="medium">
                        {date} · {shift}
                    </Text>
                    <StateChip status={status} created={created} />
                </HStack>
            </Stack>
        </HStack>
    );
}

function InitContextBannerBase(props: InitContextBannerProps) {
    return (
        <Box
            w="full"
            p="3"
            borderWidth="1px"
            borderRadius="lg"
            bg="bg"
            borderColor="border"
        >
            <Content {...props} />
        </Box>
    );
}

export const InitContextBanner = memo(InitContextBannerBase);
