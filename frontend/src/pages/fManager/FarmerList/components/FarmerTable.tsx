import { memo } from "react";
import { Box, Table, HStack, Text, Skeleton, Button, Alert } from "@chakra-ui/react";
import type { FarmerListItem } from "@/types/farmer";
import { FarmerRow } from "./FarmerRow";

export type FarmerTableProps = {
    items: FarmerListItem[];
    isLoading?: boolean;
    isFetching?: boolean;
    isError?: boolean;
    error?: unknown;
    onRetry?: () => void;

    /** Called by the row’s [View info] button */
    onView: (farmerId: string) => void;

    /** Optional: fix table height and scroll body (keeps header visible) */
    maxBodyHeight?: string | number;
};

export const FarmerTable = memo(function FarmerTable({
    items,
    isLoading = false,
    isFetching = false,
    isError = false,
    error,
    onRetry,
    onView,
    maxBodyHeight,
}: FarmerTableProps) {
    const showSkeletons = isLoading || (isFetching && items.length === 0);
    const showEmpty = !showSkeletons && !isError && items.length === 0;

    return (
        <Box>
            {/* Error banner (non-blocking) */}
            {isError && (
                <Alert.Root status="error" mb={3} borderRadius="lg">
                    <Alert.Indicator />
                    <Alert.Title>Failed to load farmers</Alert.Title>
                    <Alert.Description>{(error as any)?.message ?? "Unknown error."}</Alert.Description>
                    {onRetry && (
                        <Button size="sm" ml="auto" onClick={onRetry} variant="subtle">
                            Retry
                        </Button>
                    )}
                </Alert.Root>
            )}

            <Table.Root size="sm" variant="outline" borderRadius="xl" overflow="hidden">
                <Table.Header position="sticky" top={0} zIndex={1} bg="bg">
                    <Table.Row>
                        <Table.ColumnHeader w="56px">Logo</Table.ColumnHeader>
                        <Table.ColumnHeader>Farmer Name</Table.ColumnHeader>
                        <Table.ColumnHeader>Farm Name</Table.ColumnHeader>
                        <Table.ColumnHeader w="180px">Joined</Table.ColumnHeader>
                        <Table.ColumnHeader textAlign="right" w="140px">
                            Action
                        </Table.ColumnHeader>
                    </Table.Row>
                </Table.Header>

                <Table.Body display="block" maxH={maxBodyHeight ?? { base: "auto", md: "50vh" }} overflow="auto">
                    {/* Because Body is display:block for scrolling, rows must be blocks too */}
                    <Box as="div" display="table" w="100%">
                        {showSkeletons ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <Table.Row key={`skeleton-${i}`}>
                                    <Table.Cell>
                                        <Skeleton borderRadius="full" boxSize="32px" />
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Skeleton height="16px" width="220px" />
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Skeleton height="16px" width="220px" />
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Skeleton height="16px" width="120px" />
                                    </Table.Cell>
                                    <Table.Cell textAlign="right">
                                        <Skeleton height="28px" width="88px" />
                                    </Table.Cell>
                                </Table.Row>
                            ))
                        ) : showEmpty ? (
                            <Table.Row>
                                <Table.Cell colSpan={5}>
                                    <HStack justify="center" py={10}>
                                        <Text color="fg.subtle">No farmers found.</Text>
                                    </HStack>
                                </Table.Cell>
                            </Table.Row>
                        ) : (
                            items.map((it) => <FarmerRow key={it._id} item={it} onView={onView} />)
                        )}
                    </Box>
                </Table.Body>
            </Table.Root>
        </Box>
    );
});

export default FarmerTable;
