import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAggregations, createAggregation } from "@/api/aggregations";
import {
  Box,
  Heading,
  Button,
  VStack,
  HStack,
  Input,
  Text,
  Separator,
  Spinner,
  Table,
  Badge,
} from "@chakra-ui/react";
import QRCode from "react-qr-code";
import type { IAggregationItem } from "@/types/aggregations";
import { toaster } from "@/components/ui/toaster";

/**
 * Aggregations page. Farmers can view existing batches and create new ones.
 */
export default function Aggregations() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["aggregations"],
    queryFn: fetchAggregations,
  });

  // Local state for new aggregation items
  const [items, setItems] = useState<IAggregationItem[]>([
    { produceType: "", quantity: 0, unit: "" },
  ]);

  const createMut = useMutation({
    mutationFn: (payload: { items: IAggregationItem[] }) =>
      createAggregation(payload),
    onSuccess: () => {
      toaster.create({ title: "Aggregation created", type: "success" });
      setItems([{ produceType: "", quantity: 0, unit: "" }]);
      qc.invalidateQueries({ queryKey: ["aggregations"] });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err.message ||
        "Failed to create aggregation";
      toaster.create({ title: msg, type: "error" });
    },
  });

  const addItemRow = () =>
    setItems((it) => [...it, { produceType: "", quantity: 0, unit: "" }]);
  const removeItemRow = (idx: number) =>
    setItems((it) => it.filter((_, i) => i !== idx));

  const handleChange = (
    idx: number,
    field: keyof IAggregationItem,
    value: any
  ) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? { ...it, [field]: field === "quantity" ? Number(value) : value }
          : it
      )
    );
  };

  const create = () => {
    // filter out empty rows
    const filtered = items.filter((it) => it.produceType && it.quantity > 0);
    if (filtered.length === 0) {
      toaster.create({ title: "Add at least one item", type: "error" });
      return;
    }
    createMut.mutate({ items: filtered });
  };

  return (
    <Box p={4}>
      <Heading size="lg" mb={4}>
        Aggregations
      </Heading>

      {/* Creation form */}
      <Box borderWidth="1px" borderRadius="lg" p={4} mb={6}>
        <Heading size="md" mb={3}>
          Create Aggregation
        </Heading>
        {items.map((it, idx) => (
          <HStack key={idx} mb={2}>
            <Input
              placeholder="Produce type"
              value={it.produceType}
              onChange={(e) => handleChange(idx, "produceType", e.target.value)}
            />
            <Input
              type="number"
              placeholder="Quantity"
              value={it.quantity || ""}
              onChange={(e) => handleChange(idx, "quantity", e.target.value)}
            />
            <Input
              placeholder="Unit (e.g. kg)"
              value={it.unit || ""}
              onChange={(e) => handleChange(idx, "unit", e.target.value)}
            />
            {items.length > 1 && (
              <Button size="sm" onClick={() => removeItemRow(idx)}>
                Remove
              </Button>
            )}
          </HStack>
        ))}
        <Button size="sm" mt={2} onClick={addItemRow}>
          Add Item
        </Button>
        <Button
          colorScheme="blue"
          mt={4}
          onClick={create}
          loading={createMut.isPending}
        >
          Create
        </Button>
      </Box>

      <Separator mb={4} />

      {/* Existing aggregations */}
      <Heading size="md" mb={3}>
        My Aggregations
      </Heading>
      {isLoading && <Spinner />}
      {isError && (
        <Text color="red.400">
          {(error as any)?.message || "Failed to load aggregations"}
        </Text>
      )}
      {!isLoading && data && (
        <VStack align="stretch" gap={4}>
          {data.items.length === 0 && <Text>No aggregations created yet.</Text>}
          {data.items.map((ag) => (
            <Box key={ag.id} borderWidth="1px" borderRadius="lg" p={4}>
              <HStack justify="space-between">
                <Box>
                  <Text fontWeight="bold">ID: {ag.id}</Text>
                  <Text fontSize="sm">Token: {ag.token}</Text>
                  <Text fontSize="sm">
                    Expires:{" "}
                    {ag.expiresAt
                      ? new Date(ag.expiresAt).toLocaleString()
                      : "∞"}
                  </Text>
                </Box>
                <Box textAlign="center">
                  <QRCode
                    value={`${location.origin}/ag/${ag.token}`}
                    size={96}
                  />
                  <Text
                    fontSize="xs"
                    mt={1}
                  >{`${location.origin}/ag/${ag.token}`}</Text>
                </Box>
              </HStack>
              <Separator my={2} />
              <Heading size="sm">Items</Heading>
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Produce</Table.ColumnHeader>
                    <Table.ColumnHeader>Qty</Table.ColumnHeader>
                    <Table.ColumnHeader>Unit</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {ag.items.map((it, idx) => (
                    <Table.Row key={idx}>
                      <Table.Cell>{it.produceType}</Table.Cell>
                      <Table.Cell>{it.quantity}</Table.Cell>
                      <Table.Cell>{it.unit || "-"}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
              {ag.containers.length > 0 && (
                <>
                  <Separator my={2} />
                  <Heading size="sm">Containers</Heading>
                  <HStack gap={2} wrap="wrap">
                    {ag.containers.map((cid) => (
                      <Badge key={cid}>{cid}</Badge>
                    ))}
                  </HStack>
                </>
              )}
            </Box>
          ))}
        </VStack>
      )}
    </Box>
  );
}
