// src/pages/ShiftFarmerOrder/components/OrderList.tsx
// Grouped view for Shift Farmer Orders, mirroring the Inventory list pattern.
//
// - Groups rows by itemId.
// - Groups with at least one status === "problem" are sorted to the top.
// - Within each group, rows with status === "problem" are listed first,
//   then the rest by updatedAt desc (fallback to createdAt).
// - Uses OrderRow in variant="grouped" so the product cell is hidden and a [view] button is shown.
// - Manages an expanded row id so clicking a row reveals an inline timeline under that row.
//
// TODO(UX): If you later standardize columns across flat/grouped modes,
//           add a compact <Thead> here to match OrderRow's <Td>s for accessibility.

import { memo, useMemo } from "react";
import {
  Box,
  Stack,
  HStack,
  Text,
  Badge,
  Separator,
  Table,
  Image,
} from "@chakra-ui/react";
import { OrderRow } from "./OrderRow";
import type { ShiftFarmerOrderItem } from "@/types/farmerOrders";

export type OrderListProps = {
  /** Flat orders array to group by itemId */
  items: ShiftFarmerOrderItem[];

  /** Optional override for group labels, given the group's rows */
  renderGroupTitle?: (groupRows: ShiftFarmerOrderItem[]) => React.ReactNode;
};
const debug = false as boolean;

// (Use the fixed version; no expandedRowId state or row click handler)
export const OrderList = memo(function OrderList({
  items,
  renderGroupTitle,
}: OrderListProps) {
  const groups = useMemo(() => {

    if (debug === true) {
      // eslint-disable-next-line no-console
      console.log("[OrderList] input items:", {
        count: items?.length ?? 0,
        sample: items?.slice(0, 5),
      });
    }

    const g = groupByItemId(items);

    if (debug === true) {
      // eslint-disable-next-line no-console
      console.log(
        "[OrderList] groups created:",
        Array.from(g.entries()).map(([itemId, rows]) => ({
          itemId,
          rowsCount: rows.length,
          rowIds: rows.map((r: any) => r?._id),
        })),
      );
    }

    return g;
  }, [items]);

  const sortedGroups = useMemo(() => {
    const arr = [...groups];

    if (debug === true) {
      // eslint-disable-next-line no-console
      console.log(
        "[OrderList] groups BEFORE sort:",
        arr.map(([itemId, rows]) => ({
          itemId,
          rowsCount: rows.length,
          hasProblem: groupHasProblem(rows),
        })),
      );
    }

    arr.sort((a, b) => {
      const aHasProblem = groupHasProblem(a[1]);
      const bHasProblem = groupHasProblem(b[1]);
      if (aHasProblem && !bHasProblem) return -1;
      if (!aHasProblem && bHasProblem) return 1;
      const aLabel = computeGroupLabel(a[1]).toLowerCase();
      const bLabel = computeGroupLabel(b[1]).toLowerCase();
      return aLabel.localeCompare(bLabel);
    });

    if (debug === true) {
      // eslint-disable-next-line no-console
      console.log(
        "[OrderList] groups AFTER sort:",
        arr.map(([itemId, rows]) => ({
          itemId,
          rowsCount: rows.length,
          hasProblem: groupHasProblem(rows),
          label: computeGroupLabel(rows),
        })),
      );
    }

    return arr;
  }, [groups]);

  if (!items?.length) return null;

  if (debug === true) {
    // eslint-disable-next-line no-console
    console.log("[OrderList] rendering sortedGroups:", {
      groupCount: sortedGroups.length,
    });
  }

  return (
    <Stack gap={4}>
      {sortedGroups.map(([itemId, rows]) => {
        const hasProblem = groupHasProblem(rows);
        const title = renderGroupTitle ? renderGroupTitle(rows) : computeGroupLabel(rows);
        const sortedRows = sortRowsProblemFirstThenUpdatedDesc(rows);

        // Display the item image for the group header (uses `pictureUrl`)
        const firstRow = rows[0] as any;
        const img: string | undefined = firstRow?.pictureUrl;
        const initials =
          String(title ?? "")
            .trim()
            .slice(0, 2)
            .toUpperCase() || "??";

        // eslint-disable-next-line no-console
        if (debug === true) {
          console.log("[OrderList] render group:", {
            itemId,
            title,
            hasProblem,
            rowsCount: rows.length,
            sortedRowIds: sortedRows.map((r: any) => r?._id),
          });
        }

        return (
          <Box
            key={itemId}
            borderWidth="1px"
            borderRadius="lg"
            p={3}
            bg="bg"
            borderColor="border"
          >
            <HStack justifyContent="space-between" alignItems="center">
              <HStack gap={3} alignItems="center">
                {img ? (
                  <Image
                    src={img}
                    alt={typeof title === "string" ? title : "Item image"}
                    boxSize="36px"
                    borderRadius="md"
                    objectFit="cover"
                    border="1px solid"
                    borderColor="border"
                  />
                ) : (
                  <Box
                    boxSize="36px"
                    borderRadius="md"
                    bg="gray.200"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    fontSize="xs"
                    fontWeight="bold"
                    color="gray.600"
                  >
                    {initials}
                  </Box>
                )}

                <Text fontWeight="semibold" fontSize="lg">
                  {title}
                </Text>

                <Badge variant="solid" colorPalette="blue">
                  {sortedRows.length} orders
                </Badge>

                {hasProblem && (
                  <Badge variant="solid" colorPalette="red">
                    problem
                  </Badge>
                )}
              </HStack>
            </HStack>

            <Separator my={3} />

            <Table.Root size="sm" variant="outline">
              <Table.Body>
                {sortedRows.map((row) => (
                  <OrderRow
                    key={
                      (row as any)._id ??
                      `${(row as any).itemId ?? "item"}-${(row as any).farmerId ?? "farmer"
                      }`
                    }
                    row={row}
                    variant="grouped"
                  />
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
        );
      })}
    </Stack>
  );
});

/* --------------------------------- helpers -------------------------------- */

function groupByItemId(
  items: ShiftFarmerOrderItem[],
): Map<string, ShiftFarmerOrderItem[]> {
  const m = new Map<string, ShiftFarmerOrderItem[]>();
  for (const it of items ?? []) {
    const key = (it as any)?.itemId ?? "unknown";
    // eslint-disable-next-line no-console
    if (debug === true) {
      console.log("[OrderList] groupByItemId add:", {
        itemId: key,
        _id: (it as any)?._id,
      });
    }

    if (key === "unknown") {
      // eslint-disable-next-line no-console
      console.warn("[OrderList] groupByItemId found item with missing itemId:", it);
    }

    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(it);
  }
  return m;
}

function groupHasProblem(rows: ShiftFarmerOrderItem[]): boolean {
  return rows.some(
    (r) => ((r as any)?.farmerStatus ?? (r as any)?.status) === "problem",
  );
}

function toTime(s?: string | Date): number {
  if (!s) return 0;
  const t = typeof s === "string" ? Date.parse(s) : (s as Date).getTime?.();
  return Number.isFinite(t as number) ? (t as number) : 0;
}

function sortRowsProblemFirstThenUpdatedDesc(
  rows: ShiftFarmerOrderItem[],
): ShiftFarmerOrderItem[] {
  const result = [...rows].sort((a, b) => {
    const aProblem =
      ((a as any)?.farmerStatus ?? (a as any)?.status) === "problem";
    const bProblem =
      ((b as any)?.farmerStatus ?? (b as any)?.status) === "problem";
    if (aProblem && !bProblem) return -1;
    if (!aProblem && bProblem) return 1;

    const aTime = toTime((a as any)?.updatedAt) || toTime((a as any)?.createdAt);
    const bTime = toTime((b as any)?.updatedAt) || toTime((b as any)?.createdAt);

    return bTime - aTime; // desc (newest first)
  });

  if (debug === true) {
    console.log("[OrderList] sortRowsProblemFirstThenUpdatedDesc:", {
      itemId: (rows[0] as any)?.itemId,
      inputIds: rows.map((r: any) => r?._id),
      outputIds: result.map((r: any) => r?._id),
    });
  }

  return result;
}

/**
 * Tries to compute a human label for a group from its rows.
 * Prefers itemDisplayName if present; otherwise falls back to a composited label.
 */
function computeGroupLabel(rows: ShiftFarmerOrderItem[]): string {
  const first = rows[0] as any;
  const byDisplay =
    first?.itemDisplayName ||
    first?.productName ||
    undefined;

  if (byDisplay) return String(byDisplay);

  // Attempt compositing from optional fields commonly found in catalog-like data
  const type = first?.type;
  const variety = first?.variety;
  const category = first?.category;

  const parts = [category, type, variety].filter(Boolean);
  if (parts.length) return parts.join(" · ");

  // Final fallback
  return "Item " + (first?.itemId ?? "—");
}
