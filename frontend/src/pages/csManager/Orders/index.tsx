// src/pages/csManagerOrders/index.tsx
import React from "react";
import {
  Box,
  Stack,
  Heading,
  SimpleGrid,
  HStack,
  Text,
  Badge,
  Button,
  Separator,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

// 🔁 Reuse the dashboard hook + card for the left side
import { useCSShiftSummaries } from "../Dashboard/hooks/useCSShiftSummaries";
import { ShiftSummaryCard } from "../Dashboard/components/ShiftSummaryCard";

// Right side (previous shifts) + filters (local to orders page)
import { useCSPreviousShifts } from "./hooks/useCSPreviousShifts";
import { useCSOrderFilters } from "./hooks/useCSOrderFilters";
import FilterBar from "./components/shiftFilterBar";

export default function CSManagerOrdersPage() {
  const nav = useNavigate();

  // LEFT: current + next 5 shifts (same as dashboard)
  const { rows: summaryRows, isLoading: summaryLoading } = useCSShiftSummaries({
    horizonShifts: 6,
  });

  // RIGHT: previous shifts (paged, fake data for now)
  const {
    shifts,
    isLoading: loadingPrev,
    loadMore,
    hasMore,
    totalsPrev,
  } = useCSPreviousShifts({ pageSize: 10 });

  // Filters (date range + exact shift)
  const f = useCSOrderFilters();
  const fromMs = f.fromDate ? Date.parse(f.fromDate) : null;
  const toMsInclusive = f.toDate ? Date.parse(f.toDate) + 24 * 60 * 60 * 1000 - 1 : null;

  const shiftsFiltered = (() => {
    // exact shift search overrides range filters
    if (f.exactValid) {
      return shifts.filter(
        (s) => s.dateISO === f.searchDate && s.shift === f.searchShift
      );
    }
    return shifts.filter((s) => {
      if (fromMs && Date.parse(s.dateISO) < fromMs) return false;
      if (toMsInclusive && Date.parse(s.dateISO) > toMsInclusive) return false;
      return true;
    });
  })();

  // Summary strip: compute Now/Upcoming totals from the summary card rows
  const totalsNow = React.useMemo(() => {
    return (summaryRows ?? []).reduce(
      (acc, r) => {
        acc.total += r.counts.total ?? 0;
        acc.problem += r.counts.problem ?? 0;
        return acc;
      },
      { total: 0, problem: 0 }
    );
  }, [summaryRows]);

  const onApply = () => {
    // no-op; filters are reactive
  };
  const onClear = () => {
    f.setFromDate("");
    f.setToDate("");
    f.setSearchDate("");
    f.setSearchShift("");
  };

  return (
    <Box w="full">
      <Stack gap="6">
        <Heading size="lg">All Orders</Heading>

        {/* Filters */}
        <FilterBar
          fromDate={f.fromDate}
          toDate={f.toDate}
          setFromDate={f.setFromDate}
          setToDate={f.setToDate}
          searchDate={f.searchDate}
          searchShift={f.searchShift}
          setSearchDate={f.setSearchDate}
          setSearchShift={f.setSearchShift}
          exactValid={f.exactValid}
          onApply={onApply}
          onClear={onClear}
        />

        {/* Summary strip */}
        <SimpleGrid columns={{ base: 1, md: 3 }} gap="4">
          <HStack
            borderWidth="1px"
            borderColor={{ base: "blue.300", _dark: "blue.500" }}
            rounded="lg"
            p="4"
            justify="space-between"
          >
            <Text fontWeight="semibold">Now/Upcoming — Total</Text>
            <Text fontSize="2xl" fontWeight="bold">
              {totalsNow.total}
            </Text>
          </HStack>
          <HStack
            borderWidth="1px"
            borderColor={{ base: "red.300", _dark: "red.500" }}
            rounded="lg"
            p="4"
            justifyContent="space-between"
          >
            <Text fontWeight="semibold">Now/Upcoming — Problem</Text>
            <Text fontSize="2xl" fontWeight="bold">
              {totalsNow.problem}
            </Text>
          </HStack>
          <HStack
            borderWidth="1px"
            borderColor={{ base: "purple.300", _dark: "purple.500" }}
            rounded="lg"
            p="4"
            justify="space-between"
          >
            <Text fontWeight="semibold">Previous — Complaints</Text>
            <Text fontSize="2xl" fontWeight="bold">
              {totalsPrev.complaints}
            </Text>
          </HStack>
        </SimpleGrid>

        <Separator />

        <SimpleGrid columns={{ base: 1, xl: 2 }} gap="6" alignItems="start">
          {/* LEFT: Current & Next 5 Shifts (shared component) */}
          <ShiftSummaryCard
            title="Current & Next 5 Shifts"
            rows={summaryRows}
            loading={summaryLoading}
            onViewShift={(row) =>
              nav(`/csManager/orders?date=${row.dateISO}&shift=${row.shift}`)
            }
          />

          {/* RIGHT: Previous Shifts */}
          <Box
            borderWidth="1px"
            borderColor={{ base: "teal.300", _dark: "teal.500" }}
            rounded="lg"
            p="4"
            bg="bg"
            w="full"
          >
            <Stack gap="4">
              <HStack justify="space-between">
                <Heading size="md">
                  Previous Shifts ({shiftsFiltered.length})
                </Heading>
                <HStack gap="3">
                  <Badge colorPalette="blue">Total {totalsPrev.total}</Badge>
                  <Badge colorPalette="red">Problem {totalsPrev.problem}</Badge>
                  <Badge colorPalette="purple">
                    Complaints {totalsPrev.complaints}
                  </Badge>
                </HStack>
              </HStack>

              {loadingPrev && shiftsFiltered.length === 0 ? (
                <Stack gap="2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Box key={i} h="10" borderWidth="1px" rounded="md" />
                  ))}
                </Stack>
              ) : shiftsFiltered.length === 0 ? (
                <Text color="fg.muted">No previous shifts match the filters.</Text>
              ) : (
                <Stack gap="2">
                  {shiftsFiltered.map((s) => (
                    <HStack
                      key={`${s.dateISO}__${s.shift}`}
                      justify="space-between"
                      px="3"
                      py="2"
                      borderWidth="1px"
                      borderRadius="md"
                    >
                      <Text fontWeight="medium">
                        {s.dateISO} · {s.shift}
                      </Text>
                      <HStack gap="3">
                        <Badge colorPalette="blue">Total {s.counts.total}</Badge>
                        <Badge colorPalette="red">Problem {s.counts.problem}</Badge>
                        <Badge colorPalette="purple">
                          Complaints {s.counts.complaints}
                        </Badge>
                        <Button
                          size="sm"
                          onClick={() =>
                            nav(
                              `/csManager/orders?date=${s.dateISO}&shift=${s.shift}`
                            )
                          }
                        >
                          View
                        </Button>
                      </HStack>
                    </HStack>
                  ))}
                  {hasMore && !f.exactValid && (
                    <Button onClick={loadMore} alignSelf="center" variant="outline">
                      Load next page
                    </Button>
                  )}
                </Stack>
              )}
            </Stack>
          </Box>
        </SimpleGrid>
      </Stack>
    </Box>
  );
}
