// src/pages/CreateStock/components/InventoryList.tsx
// Renders farmer inventory grouped by itemId with demand statistic per group.
// - Uses useFarmerInventory(amsId) to load inventory and demand stats
// - Removes useCreateFarmerOrder (WIP only; submit handled inside item card via console.log)
// - Client-side filter & sort (ignore BE pagination per product decision)
//
// TODO(sort/filter): Expand sort options if needed.
// TODO(UX): Add virtualization/pagination later if lists grow large.
// TODO(hooks): Extract demand-stats fetching into a tiny useDemandStatistics hook if reused elsewhere.

import { memo, useEffect, useMemo, useState } from "react";
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
import type { FarmerInventoryItem, DemandStatisticsResponse } from "@/types/farmerInventory";
import { useFarmerInventory } from "../hooks/useFarmerInventory";
import { InventoryItemCard } from "./InventoryItemCard";

/* ---------------------------------- types --------------------------------- */

type SortKey = "updatedDesc" | "availableDesc" | "nameAsc";

type DemandEntry = {
    itemId: string;
    itemDisplayName?: string | null;
    averageDemandQuantityKg?: number | null;
};

type DemandMap = Map<
    string,
    { itemDisplayName?: string; averageDemandQuantityKg?: number }
>;

/* --------------------------------- helpers -------------------------------- */

function groupByItemId(items: FarmerInventoryItem[]) {
    const map = new Map<string, FarmerInventoryItem[]>();
    for (const it of items) {
        const list = map.get(it.itemId);
        if (list) list.push(it);
        else map.set(it.itemId, [it]);
    }
    return map;
}

function shortenId(id: string, len = 8) {
    return id?.slice(0, len) ?? "";
}

function sortGroupKeys(
    groupMap: Map<string, FarmerInventoryItem[]>,
    key: SortKey
): string[] {
    const keys = Array.from(groupMap.keys());
    if (key === "nameAsc") {
        keys.sort((a, b) => a.localeCompare(b));
        return keys;
    }

    // Precompute group metrics
    const metrics = new Map<
        string,
        { latestUpdatedAt: number; totalAvailableKg: number }
    >();
    for (const k of keys) {
        const rows = groupMap.get(k)!;
        let latest = 0;
        let sumAvail = 0;
        for (const r of rows) {
            const t = new Date(r.updatedAt ?? r.createdAt).getTime();
            if (t > latest) latest = t;
            sumAvail += Number(r.currentAvailableAmountKg ?? 0);
        }
        metrics.set(k, { latestUpdatedAt: latest, totalAvailableKg: sumAvail });
    }

    if (key === "availableDesc") {
        keys.sort(
            (a, b) =>
                (metrics.get(b)?.totalAvailableKg ?? 0) -
                (metrics.get(a)?.totalAvailableKg ?? 0)
        );
        return keys;
    }

    // default: updatedDesc
    keys.sort(
        (a, b) =>
            (metrics.get(b)?.latestUpdatedAt ?? 0) -
            (metrics.get(a)?.latestUpdatedAt ?? 0)
    );
    return keys;
}

/* ---------------------------------- view ---------------------------------- */

function InventoryListBase() {
    const {
        status,
        items,
        error,
        isEmpty,
        // meta, hasData, refetch  // (kept unused now; can re-enable later)
        fetchDemandStatistics,
    } = useFarmerInventory();

    const [query, setQuery] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("updatedDesc");

    // --------------------------- demand statistics ---------------------------
    const [demandMap, setDemandMap] = useState<DemandMap>(new Map());

    useEffect(() => {
        let alive = true;

        // NOTE: “use the first one we get”
        // We’ll call the provided hook method and build an itemId -> first entry map.
        async function loadDemand() {
            try {
                const res = await fetchDemandStatistics?.();
                console.log("[InventoryList] fetched demand statistics:", res);

                // The API returns slot buckets: { items: [{ slotKey, items: DemandEntry[] }], ... }
                // Per your requirement, "use the first one we get".
                // Also tolerate a flat shape: { items: DemandEntry[] }.
                let slotEntries: DemandEntry[] = [];

                if (Array.isArray(res?.items) && res.items.length > 0) {
                    const first = res.items[0];
                    if (first && Array.isArray(first.items)) {
                        // Bucketed-by-slot shape
                        slotEntries = first.items as DemandEntry[];
                    } else if (res.items.length && (res.items[0] as any).itemId) {
                        // Flat shape fallback
                        slotEntries = res.items as DemandEntry[];
                    }
                }

                const map: DemandMap = new Map();
                for (const e of slotEntries) {
                    if (!e?.itemId) continue;
                    if (!map.has(e.itemId)) {
                        map.set(e.itemId, {
                            itemDisplayName: e.itemDisplayName ?? undefined,
                            averageDemandQuantityKg: e.averageDemandQuantityKg ?? undefined,
                        });
                    }
                }
                console.log("[InventoryList] built demand map:", map);

                if (alive) setDemandMap(map);
            } catch (e) {
                console.warn("[InventoryList] demand stats fetch failed:", e);
                if (alive) setDemandMap(new Map());
            }
        }


        // Only fetch once we actually have inventory (prevents wasted calls on initial mounts that will be immediately replaced)
        if (status === "success") {
            void loadDemand();
        }

        return () => {
            alive = false;
        };
    }, [status, fetchDemandStatistics]);

    // ----------------------------- filter + group ----------------------------
    const filteredGrouped = useMemo(() => {
        const q = query.trim().toLowerCase();
        const base = q
            ? items.filter(
                (it) =>
                    it.itemId.toLowerCase().includes(q) ||
                    it.farmerUserId.toLowerCase().includes(q)
            )
            : items;

        return groupByItemId(base);
    }, [items, query]);

    const sortedGroupKeys = useMemo(
        () => sortGroupKeys(filteredGrouped, sortKey),
        [filteredGrouped, sortKey]
    );

    const totalVisibleRows = useMemo(
        () => Array.from(filteredGrouped.values()).reduce((n, rows) => n + rows.length, 0),
        [filteredGrouped]
    );

    return (
        <Stack gap="4" w="full">
            {/* Toolbar */}
            <HStack justify="space-between" flexWrap="wrap" gap="3">
                <HStack gap="2" flex="1 1 360px">
                    <Input
                        placeholder="Filter by itemId or farmerId…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Filter inventory"
                    />
                    <NativeSelect.Root>
                        <NativeSelect.Field
                            value={sortKey}
                            onChange={(e) => setSortKey(e.target.value as SortKey)}
                            aria-label="Sort inventory"
                        >
                            <option value="updatedDesc">Last updated (newest)</option>
                            <option value="availableDesc">Available (high → low)</option>
                            <option value="nameAsc">Item (id asc)</option>
                        </NativeSelect.Field>
                        <NativeSelect.Indicator />
                    </NativeSelect.Root>
                </HStack>
                <Text fontSize="sm" color="fg.muted">
                    {status === "success" ? `${totalVisibleRows} rows in ${sortedGroupKeys.length} groups` : "—"}
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
                        {String(error ?? "Unknown error.")}
                    </Text>
                </Box>
            ) : null}

            {/* Empty state */}
            {status === "success" && isEmpty ? (
                <Box borderWidth="1px" p="6" borderRadius="md" bg="bg" textAlign="center">
                    <Text color="fg.muted">No inventory items found for this AMS.</Text>
                </Box>
            ) : null}

            {/* Groups */}
            {status === "success" && sortedGroupKeys.length > 0 ? (
                <Stack gap="3">
                    {sortedGroupKeys.map((itemId) => {
                        const rows = filteredGrouped.get(itemId)!;
                        const demand = demandMap.get(itemId);
                        // Use the first demand entry we got; fallbacks if missing
                        const itemDisplayName = demand?.itemDisplayName ?? itemId;
                        const averageDemandQuantityKg = demand?.averageDemandQuantityKg;

                        // Build a compact group header subtitle (optional)
                        const latestUpdated = rows
                            .map((r) => new Date(r.updatedAt ?? r.createdAt).getTime())
                            .reduce((max, t) => (t > max ? t : max), 0);
                        const latestUpdatedISO = latestUpdated
                            ? new Date(latestUpdated).toLocaleString()
                            : "";

                        return (
                            <InventoryItemCard
                                key={itemId}
                                // group-level props
                                itemId={itemId}
                                itemDisplayName={itemDisplayName}
                                averageDemandQuantityKg={averageDemandQuantityKg}
                                // rows for farmers that share this item
                                rows={rows}
                                // optional meta to show under header (can be used or ignored by card)
                                subtitle={`latest update: ${latestUpdatedISO}`}
                                // helpers (can be ignored by card)
                                formatFarmerId={shortenId}
                            />
                        );
                    })}
                </Stack>
            ) : null}
        </Stack>
    );
}

export const InventoryList = memo(InventoryListBase);
