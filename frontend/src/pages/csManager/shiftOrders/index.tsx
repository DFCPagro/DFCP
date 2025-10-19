import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Heading,
  Stack,
  HStack,
  Text,
  Separator,
  Spinner,
  Alert,
  Button,
} from "@chakra-ui/react";

import { useShiftQueryParams } from "./hooks/useShiftQueryParams";
import { useCSOrdersForShift } from "./hooks/useCSOrdersForShift";
import { OrdersTable } from "./components/ordersTable";
import { FilterBar } from "./components/filterBar";
import type { CSOrder } from "@/types/cs.orders";

export default function CSManagerShiftOrders() {
  const navigate = useNavigate();
  const { date, shiftName } = useShiftQueryParams();

  // TODO: replace with LC id from auth/context
  const logisticCenterId = "66e007000000000000000001";

  // simple UI filters
  const [status, setStatus] = useState<string | undefined>();
  const [problemOnly, setProblemOnly] = useState(false);

  const { data, isLoading, error } = useCSOrdersForShift({
    logisticCenterId,
    date,
    shiftName,
    status: problemOnly ? "problem" : status,
  });

  // always work with an array (NOT data directly)
  const items: CSOrder[] = useMemo(() => {
    const arr = (data?.items ?? []).slice();
    arr.sort((a, b) => {
      if (a.status === "problem" && b.status !== "problem") return -1;
      if (a.status !== "problem" && b.status === "problem") return 1;
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    });
    return arr;
  }, [data]);

  const meta = data?.meta;

  return (
    <Box w="full">
      <Stack gap="5">
        <HStack justify="space-between" align="center">
          <Heading size="lg">
            Orders — {date} · {shiftName}
            {meta && (
              <Text as="span" fontSize="sm" color="fg.muted" ml="2">
                ({meta.total} total, {meta.problemCount} problem) · TZ:{" "}
                {meta.tz}
              </Text>
            )}
          </Heading>
          <Button onClick={() => navigate(-1)}>Back</Button>
        </HStack>

        <Separator />

        <FilterBar
          status={status}
          setStatus={setStatus}
          problemOnly={problemOnly}
          setProblemOnly={setProblemOnly}
        />

        {isLoading && (
          <HStack>
            <Spinner />
            <Text>Loading orders…</Text>
          </HStack>
        )}

        {error && (
          <Alert.Root status="error">
            <Alert.Indicator />
            <Alert.Title>Failed to load orders</Alert.Title>
            <Alert.Description>
              Failed to load orders for {date} · {shiftName}
            </Alert.Description>
          </Alert.Root>
        )}

        {!isLoading && !error && items.length === 0 && (
          <Alert.Root status="info">
            <Alert.Indicator />
            <Alert.Title>No orders found</Alert.Title>
            <Alert.Description>
              No orders found for this shift.
            </Alert.Description>
          </Alert.Root>
        )}

        {items.length > 0 && <OrdersTable items={items} />}
      </Stack>
    </Box>
  );
}
