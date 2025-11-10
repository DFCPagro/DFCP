// src/pages/csManagerOrders/PreviousShiftsOnly.tsx
import React from "react";
import {
  Box,
  Stack,
  Heading,
  HStack,
  Text,
  Badge,
  Button,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

// Reuse your existing hooks
import { useCSPreviousShifts } from "./hooks/useCSPreviousShifts";
import { useCSOrderFilters } from "./hooks/useCSOrderFilters";

export default function PreviousShiftsOnlyPage() {
  const nav = useNavigate();

  // previous shifts (paged, same source as original page)
  const {
    shifts,
    isLoading: loadingPrev,
    loadMore,
    hasMore,
    totalsPrev,
  } = useCSPreviousShifts({ pageSize: 10 });

  // local filters, identical behavior to the source
  const f = useCSOrderFilters();
  const fromMs = f.fromDate ? Date.parse(f.fromDate) : null;
  const toMsInclusive = f.toDate ? Date.parse(f.toDate) + 24 * 60 * 60 * 1000 - 1 : null;

  const shiftsFiltered = React.useMemo(() => {
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
  }, [shifts, f.exactValid, f.searchDate, f.searchShift, fromMs, toMsInclusive]);

  return (
    <Box w="full" p={{ base: 4, md: 6 }}>
      <Box
        borderWidth="1px"
        borderColor={{ base: "teal.300", _dark: "teal.500" }}
        rounded="lg"
        p="4"
        bg="bg"
        w="full"
        maxW="7xl"
        mx="auto"
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
                        nav(`/csManager/orders?date=${s.dateISO}&shift=${s.shift}`)
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
    </Box>
  );
}
