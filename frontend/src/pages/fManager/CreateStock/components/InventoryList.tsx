// Renders the farmer inventory for the current AMS, with a tiny toolbar.
// - Uses useFarmerInventory(amsId) for data
// - Uses useCreateFarmerOrder(amsId) for per-item submit
// - Client-side filter & sort (ignore BE pagination per product decision)
//
// TODO(sort/filter): Adjust default sort and add more options as needed.
// TODO(UX): Add virtualization/pagination later if lists grow large.

import { memo, useMemo, useState } from "react";
import {
    Box,
    Stack,
    HStack,
    Text,
    Input,
    Skeleton,
    Separator,
    NativeSelect,
} from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import type { FarmerInventoryItem } from "../types";
import { useFarmerInventory } from "../hooks/useFarmerInventory";
import { useCreateFarmerOrder } from "../hooks/useCreateFarmerOrder";

// NOTE: We'll implement this next.
// It should accept props: { item, onSubmit, isSubmitting }
// and internally handle the table layout + button disable rule.
import { InventoryItemCard } from "./InventoryItemCard";

export type InventoryListProps = {
    amsId: string;
};

type SortKey = "updatedDesc" | "availableDesc" | "nameAsc";

function sortItems(items: FarmerInventoryItem[], key: SortKey): FarmerInventoryItem[] {
    const copy = [...items];
    switch (key) {
        case "availableDesc":
            return copy.sort(
                (a, b) => (b.currentAvailableAmountKg ?? 0) - (a.currentAvailableAmountKg ?? 0)
            );
        case "nameAsc":
            // We don't have itemName from BE yet—fallback to itemId asc for determinism
            return copy.sort((a, b) => a.itemId.localeCompare(b.itemId));
        case "updatedDesc":
        default:
            return copy.sort(
                (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
    }
}

function InventoryListBase({ amsId }: InventoryListProps) {
    const { status, items, error, refetch, isEmpty } = useFarmerInventory(amsId);
    const { create, isSubmitting } = useCreateFarmerOrder(amsId);

    const [query, setQuery] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("updatedDesc");

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const base = q
            ? items.filter(
                (it) =>
                    it.itemId.toLowerCase().includes(q) ||
                    it.farmerId.toLowerCase().includes(q)
            )
            : items;
        return sortItems(base, sortKey);
    }, [items, query, sortKey]);

    const handleSubmit = async (item: FarmerInventoryItem) => {
        // Disable handled inside InventoryItemCard using isSubmitting + available rule
        const result = await create({ itemId: item.itemId });
        if (result) {
            toaster.create({
                type: "success",
                title: "Farmer order created",
                description: `Order ${result.orderId} for item ${item.itemId}`,
                duration: 2000,
            });
            // Optional: refetch inventory if creation affects availability.
            // TODO(behavior): If BE decrements availability on order creation, call refetch().
            // void refetch();
        } else {
            toaster.create({
                type: "error",
                title: "Failed to create order",
                description: "Please try again.",
            });
        }
    };

    return (
        <Stack gap="4" w="full">
            {/* Toolbar */}
            <HStack justify="space-between" wrap="wrap" gap="3">
                <HStack gap="2" flex="1 1 360px">
                    <Input
                        placeholder="Filter by itemId or farmerId…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Filter inventory"
                    />
                    <NativeSelect.Root  >
                        <NativeSelect.Field placeholder={sortKey} value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} aria-label="Sort inventory">
                            <option value="updatedDesc">Last updated (newest)</option>
                            <option value="availableDesc">Available (high → low)</option>
                            <option value="nameAsc">Item (id asc)</option>
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                    </NativeSelect.Root>
                </HStack>
                <Text fontSize="sm" color="fg.muted">
                    {status === "success" ? `${filtered.length} items` : "—"}
                </Text>
            </HStack>

            <Separator />

            {/* Loading state */}
            {status === "loading" ? (
                <Stack gap="3">
                    <Skeleton h="24" />
                    <Skeleton h="24" />
                    <Skeleton h="24" />
                </Stack>
            ) : null}

            {/* Error state */}
            {status === "error" ? (
                <Box borderWidth="1px" p="4" borderRadius="md" bg="bg" borderColor="red.200">
                    <Text color="red.500" fontWeight="medium" mb="1">
                        Failed to load inventory
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                        {error ?? "Unknown error."}
                    </Text>
                </Box>
            ) : null}

            {/* Empty state */}
            {status === "success" && isEmpty ? (
                <Box borderWidth="1px" p="6" borderRadius="md" bg="bg" textAlign="center">
                    <Text color="fg.muted">No inventory items found for this AMS.</Text>
                </Box>
            ) : null}

            {/* Items */}
            {status === "success" && filtered.length > 0 ? (
                <Stack gap="3">
                    {filtered.map((item) => (
                        <InventoryItemCard
                            key={item.id}
                            item={item}
                            isSubmitting={isSubmitting(item.itemId)}
                            onSubmit={() => handleSubmit(item)}
                        />
                    ))}
                </Stack>
            ) : null}
        </Stack>
    );
}

export const InventoryList = memo(InventoryListBase);
