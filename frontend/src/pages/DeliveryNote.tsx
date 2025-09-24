// src/pages/DeliveryNote.tsx
import { useMemo } from "react";
import {
  Box,
  Container,
  Heading,
  Grid,
  GridItem,
  Text,
  HStack,
  VStack,
  Separator,
  Table,
  Badge,
  Button,
  SimpleGrid,
  Stack,
  Stat,
} from "@chakra-ui/react";

// --- Types ---
export type Quality = "A" | "B" | "C";
export type DeliveryNoteItem = {
  id: string;
  name: string;
  farmer?: string;
  quality: Quality;
  unitPrice: number;
  quantityKg: number;
  totalVolume?: number;
};
export type Party = { name: string; address: string; phone?: string };
export type DeliveryNoteData = {
  noteNumber: string;
  orderNumber?: string;
  dateISO: string;
  logisticsCenter?: string;
  seller?: Party;
  buyer?: Party;
  currency?: string;
  items: DeliveryNoteItem[];
};

// --- Mock data ---
const MOCK_NOTE: DeliveryNoteData = {
  noteNumber: "DN-2025-000123",
  orderNumber: "ORD-778899",
  dateISO: new Date().toISOString(),
  logisticsCenter: "LC-01 Tel Aviv",
  seller: { name: "DFCP Logistics", address: "1 Market Way, Tel Aviv", phone: "+972-50-000-0000" },
  buyer: { name: "Alex Cohen", address: "Herzl St 10, Rishon LeZion", phone: "+972-54-123-4567" },
  currency: "ILS",
  items: [
    { id: "1", name: "Tomato Roma", farmer: "Levy Farm", quality: "A", unitPrice: 8.5, quantityKg: 6, totalVolume: 0.012 },
    { id: "2", name: "Cucumber", farmer: "Negev Greens", quality: "B", unitPrice: 6.2, quantityKg: 4.5, totalVolume: 0.010 },
    { id: "3", name: "Strawberry Albion", farmer: "Galilee Fields", quality: "A", unitPrice: 24, quantityKg: 2, totalVolume: 0.006 },
  ],
};

// --- Utils ---
function money(n: number, currency = "ILS") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

// --- Component ---
export default function DeliveryNotePage({ data = MOCK_NOTE }: { data?: DeliveryNoteData }) {
  const currency = data.currency ?? "ILS";

  const totals = useMemo(() => {
    const totalWeight = data.items.reduce((s, i) => s + i.quantityKg, 0);
    const subTotal = data.items.reduce((s, i) => s + i.unitPrice * i.quantityKg, 0);
    const totalVolume = data.items.reduce((s, i) => s + (i.totalVolume ?? 0), 0);
    return { totalWeight, subTotal, totalVolume };
  }, [data]);

  return (
    <Container maxW="6xl" py={6}>
      <HStack justify="space-between" align="start">
        <Heading size="lg">Delivery Note</Heading>
        <Button onClick={() => window.print()} variant="outline" size="sm">Print</Button>
      </HStack>

      <Grid templateColumns={{ base: "1fr", md: "2fr 1fr" }} gap={4} mt={4}>
        <GridItem>
          <Box borderWidth="1px" borderRadius="lg" p={4}>
            <SimpleGrid columns={{ base: 1, sm: 2 }} gap={4}>
              <Box>
                <Text fontWeight="semibold">Delivery Note #</Text>
                <Text>{data.noteNumber}</Text>
              </Box>
              {data.orderNumber && (
                <Box>
                  <Text fontWeight="semibold">Order #</Text>
                  <Text>{data.orderNumber}</Text>
                </Box>
              )}
              <Box>
                <Text fontWeight="semibold">Date</Text>
                <Text>{new Date(data.dateISO).toLocaleString()}</Text>
              </Box>
              {data.logisticsCenter && (
                <Box>
                  <Text fontWeight="semibold">Logistics Center</Text>
                  <Text>{data.logisticsCenter}</Text>
                </Box>
              )}
            </SimpleGrid>

            <Separator my={4} />
            <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
              <PartyCard title="Seller" party={data.seller} />
              <PartyCard title="Buyer" party={data.buyer} />
            </SimpleGrid>
          </Box>
        </GridItem>

        <GridItem>
          <Box borderWidth="1px" borderRadius="lg" p={4}>
            <Text fontWeight="semibold" mb={2}>Note QR</Text>
            <Box w="140px" h="140px" bg="blue.400" borderRadius="md" />
            <Text mt={2} fontSize="xs" color="gray.600">Blue box = QR placeholder</Text>
          </Box>
        </GridItem>
      </Grid>

      <Box borderWidth="1px" borderRadius="lg" mt={6} overflowX="auto">
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Product</Table.ColumnHeader>
              <Table.ColumnHeader>Farmer</Table.ColumnHeader>
              <Table.ColumnHeader>Quality</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">Unit Price</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">Qty (kg)</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">Line Total</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="right">Volume</Table.ColumnHeader>
              <Table.ColumnHeader>QR</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {data.items.map((item) => {
              const lineTotal = item.unitPrice * item.quantityKg;
              return (
                <Table.Row key={item.id}>
                  <Table.Cell>
                    <VStack align="start" gap={0}>
                      <Text>{item.name}</Text>
                    </VStack>
                  </Table.Cell>
                  <Table.Cell>{item.farmer ?? "-"}</Table.Cell>
                  <Table.Cell>
                    <Badge colorPalette={item.quality === "A" ? "green" : item.quality === "B" ? "yellow" : "red"}>
                      {item.quality}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell textAlign="right">{money(item.unitPrice, currency)}</Table.Cell>
                  <Table.Cell textAlign="right">{item.quantityKg.toFixed(2)}</Table.Cell>
                  <Table.Cell textAlign="right">{money(lineTotal, currency)}</Table.Cell>
                  <Table.Cell textAlign="right">{item.totalVolume ? item.totalVolume.toFixed(3) : "-"}</Table.Cell>
                  <Table.Cell>
                    <Box w="48px" h="48px" bg="blue.400" borderRadius="sm" />
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
      </Box>

      <Stack direction={{ base: "column", md: "row" }} justify="flex-end" gap={6} mt={6}>
        <Box minW="160px">
          <Stat.Root>
            <Stat.Label>Total Weight (kg)</Stat.Label>
            <Stat.ValueText>{totals.totalWeight.toFixed(2)}</Stat.ValueText>
          </Stat.Root>
        </Box>
        <Box minW="160px">
          <Stat.Root>
            <Stat.Label>Total Volume</Stat.Label>
            <Stat.ValueText>{totals.totalVolume.toFixed(3)}</Stat.ValueText>
          </Stat.Root>
        </Box>
        <Box minW="160px">
          <Stat.Root>
            <Stat.Label>Subtotal</Stat.Label>
            <Stat.ValueText>{money(totals.subTotal, currency)}</Stat.ValueText>
          </Stat.Root>
        </Box>
      </Stack>

      <Text fontSize="xs" color="gray.600" mt={4}>
        Replace blue boxes with QR components when ready.
      </Text>
    </Container>
  );
}

function PartyCard({ title, party }: { title: string; party?: Party }) {
  return (
    <Box borderWidth="1px" borderRadius="md" p={3}>
      <Text fontWeight="semibold" mb={1}>{title}</Text>
      {party ? (
        <VStack align="start" gap={0}>
          <Text>{party.name}</Text>
          <Text>{party.address}</Text>
          {party.phone && <Text>{party.phone}</Text>}
        </VStack>
      ) : (
        <Text color="gray.500">—</Text>
      )}
    </Box>
  );
}
