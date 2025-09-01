import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchContainers, createContainer } from "@/api/containers";
import { fetchAggregations } from "@/api/aggregations";
import {
  Box,
  Heading,
  Input,
  HStack,
  VStack,
  Button,
  Text,
  Select,
  createListCollection,
  Separator,
  Spinner,
  Badge,
  Table,
} from "@chakra-ui/react";
import QRCode from "react-qr-code";
import { toaster } from "@/components/ui/toaster";

/**
 * Containers page. Farmers can create individual container barcodes and see
 * existing ones.  A container can optionally be linked to one of their
 * aggregations (batches).
 */
export default function ContainersPage() {
  const qc = useQueryClient();
  const {
    data: containers,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["containers"],
    queryFn: fetchContainers,
  });
  // fetch aggregations for linking in the create form
  const { data: aggs } = useQuery({
    queryKey: ["aggregations", "for-container"],
    queryFn: fetchAggregations,
  });

  // form state
  const [produceType, setProduceType] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [weight, setWeight] = useState<number | "">("");
  const [qualityGrade, setQualityGrade] = useState("");
  const [aggregationId, setAggregationId] = useState("");

  const rawItems =
    aggs?.items.map((ag) => {
      const label = ag.items
        .map((it) => `${it.quantity}${it.unit ?? ""} ${it.produceType}`)
        .join(", ");
      return {
        id: ag.id,
        label,
      };
    }) ?? [];

  const collection = createListCollection({ items: rawItems }); // ✅ Wrap in { items: [...] }

  const createMut = useMutation({
    mutationFn: (payload: {
      produceType: string;
      quantity: number;
      weight?: number;
      qualityGrade?: string;
      aggregationId?: string;
    }) => createContainer(payload),
    onSuccess: () => {
      toaster.create({ title: "Container created", type: "success" });
      // reset form
      setProduceType("");
      setQuantity("");
      setWeight("");
      setQualityGrade("");
      setAggregationId("");
      qc.invalidateQueries({ queryKey: ["containers"] });
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err.message ||
        "Failed to create container";
      toaster.create({ title: msg, type: "error" });
    },
  });

  const submit = () => {
    if (!produceType || !quantity) {
      toaster.create({
        title: "Produce and quantity are required",
        type: "error",
      });
      return;
    }
    const payload: any = { produceType, quantity: Number(quantity) };
    if (weight) payload.weight = Number(weight);
    if (qualityGrade) payload.qualityGrade = qualityGrade;
    if (aggregationId) payload.aggregationId = aggregationId;
    createMut.mutate(payload);
  };

  return (
    <Box p={4}>
      <Heading size="lg" mb={4}>
        Containers
      </Heading>

      {/* Create container form */}
      <Box borderWidth="1px" borderRadius="lg" p={4} mb={6}>
        <Heading size="md" mb={3}>
          Create Container
        </Heading>
        <VStack align="stretch" gap={3}>
          <Input
            placeholder="Produce type"
            value={produceType}
            onChange={(e) => setProduceType(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Quantity"
            value={quantity}
            onChange={(e) =>
              setQuantity(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
          <Input
            type="number"
            placeholder="Weight (kg)"
            value={weight}
            onChange={(e) =>
              setWeight(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
          <Input
            placeholder="Quality grade"
            value={qualityGrade}
            onChange={(e) => setQualityGrade(e.target.value)}
          />
          <Select.Root
            value={aggregationId ? [aggregationId] : []}
            onValueChange={(details) => setAggregationId(details.value[0])}
            collection={collection}
          >
            <Select.HiddenSelect name="aggregation" />
            <Select.Trigger>
              <Select.ValueText placeholder="No aggregation" />
            </Select.Trigger>
            <Select.Content>
              {rawItems.map((item) => (
                <Select.Item key={item.id} item={item}>
                  {item.label}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>

          <Button
            colorScheme="blue"
            onClick={submit}
            loading={createMut.isPending}
          >
            Create
          </Button>
        </VStack>
      </Box>

      <Separator mb={4} />
      <Heading size="md" mb={3}>
        My Containers
      </Heading>
      {isLoading && <Spinner />}
      {isError && (
        <Text color="red.400">
          {(error as any)?.message || "Failed to load containers"}
        </Text>
      )}
      {!isLoading && containers && (
        <VStack align="stretch" gap={4}>
          {containers.items.length === 0 && (
            <Text>No containers created yet.</Text>
          )}
          {containers.items.map((c) => (
            <Box key={c.id} borderWidth="1px" borderRadius="lg" p={4}>
              <HStack justify="space-between">
                <Box>
                  <Text fontWeight="bold">Barcode: {c.barcode}</Text>
                  <Text fontSize="sm">Produce: {c.produceType}</Text>
                  <Text fontSize="sm">Quantity: {c.quantity}</Text>
                  {c.weight !== undefined && (
                    <Text fontSize="sm">Weight: {c.weight}</Text>
                  )}
                  {c.qualityGrade && (
                    <Text fontSize="sm">Grade: {c.qualityGrade}</Text>
                  )}
                  {c.scannedAt && <Badge colorScheme="green">Scanned</Badge>}
                  {c.aggregationId && (
                    <Text fontSize="sm">Aggregation: {c.aggregationId}</Text>
                  )}
                </Box>
                <Box textAlign="center">
                  {/* Show QR code for scanning */}
                  {c.barcode && (
                    <>
                      <QRCode
                        value={`${location.origin}/c/${c.barcode}`}
                        size={96}
                      />
                      <Text
                        fontSize="xs"
                        mt={1}
                      >{`${location.origin}/c/${c.barcode}`}</Text>
                    </>
                  )}
                </Box>
              </HStack>
            </Box>
          ))}
        </VStack>
      )}
    </Box>
  );
}
