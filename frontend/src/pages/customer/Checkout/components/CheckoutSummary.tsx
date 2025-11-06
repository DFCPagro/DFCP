// src/pages/checkout/components/CheckoutSummary.tsx
import { memo, useMemo } from "react";
import {
  Box,
  Button,
  Card,
  HStack,
  Icon,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react";
import { FiCalendar, FiClock, FiHome, FiTruck, FiChevronRight } from "react-icons/fi";

import type { CartLine as SharedCartLine } from "@/utils/market/marketCart.shared";
import ItemList, { type ItemRow } from "@/components/common/ItemList";

/* ---------------------------------- Types --------------------------------- */

export type MoneyTotals = {
  itemCount: number;
  subtotal: number;
};

export type CheckoutSummaryProps = {
  cartLines: SharedCartLine[];

  deliveryAddress?: any | null;
  deliveryDate: string | null;  // ISO yyyy-mm-dd
  shiftName: string | null;
  amsId?: string | null;
  logisticsCenterId?: string | null;

  totals: MoneyTotals;

  onContinue?: () => void;
  onEditAddress?: () => void;
  isLoading?: boolean;
};

/* --------------------------------- helpers -------------------------------- */

function formatCurrencyUSD(n: number | undefined | null): string {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(v) ? v : 0);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString();
  } catch {
    return iso as string;
  }
}

function toItemRows(lines: SharedCartLine[]): ItemRow[] {
  return (lines ?? []).map((l, i) => {
    const id = l.key || l.stockId || l.itemId || String(i);
    const unit = l.unit === "unit" ? "unit" : "kg";
    const qty = Number(l.quantity) || 0;
    const avg = typeof l.avgWeightPerUnitKg === "number" ? l.avgWeightPerUnitKg : 0;

    const pricePerKg =
      unit === "kg"
        ? Number(l.pricePerUnit) || 0
        : avg > 0
        ? Math.round((Number(l.pricePerUnit) / avg) * 100) / 100
        : 0;

    const priceEach = unit === "unit" ? Number(l.pricePerUnit) || 0 : undefined;

    return {
      id,
      title: l.name || "Item",
      imageUrl: l.imageUrl || undefined,
      category: l.category || undefined,

      farmName: l.farmName ?? l.farmerName ?? null,
      farmLogo: l.farmLogo ?? null,

      pricePerUnit: pricePerKg,
      pricePerUnitEach: priceEach,

      unitMode: l.unitMode ?? unit,
      qtyKg: unit === "kg" ? qty : undefined,
      qtyUnits: unit === "unit" ? Math.round(qty) : undefined,
      avgWeightPerUnitKg: avg,
      availableUnitsEstimate:
        typeof l.availableUnitsEstimate === "number" ? l.availableUnitsEstimate : undefined,

      currencySymbol: "$",
    };
  });
}

/* -------------------------------- component -------------------------------- */

export const CheckoutSummary = memo(function CheckoutSummary(props: CheckoutSummaryProps) {
  const {
    cartLines,
    deliveryAddress,
    deliveryDate,
    shiftName,
    totals,
    onContinue,
    onEditAddress,
    isLoading,
  } = props;

  const itemRows = useMemo(() => toItemRows(cartLines), [cartLines]);

  // fees and totals
  const deliveryBase = 5; // USD
  const taxUsd = 0;
  const qualifiesFreeDelivery = totals.subtotal >= 100;

  const appliedDelivery = qualifiesFreeDelivery ? 0 : deliveryBase;
  const freeDeliveryDeduction = qualifiesFreeDelivery ? deliveryBase : 0;

  const totalPrice = Math.round((totals.subtotal + appliedDelivery + taxUsd) * 100) / 100;

  return (
    <Stack gap={4}>
      {/* Delivery details */}
      <Card.Root>
        <Card.Header pb={2}>
          <HStack gap={2}>
            <Icon as={FiTruck} />
            <Text fontWeight="semibold">Delivery details</Text>
          </HStack>
        </Card.Header>
        <Card.Body pt={0}>
          <Stack gap={3}>
            <HStack gap={3}>
              <Icon as={FiHome} />
              <Box flex="1">
                <Text fontSize="sm" color="fg.muted">
                  Address
                </Text>
                <Text>{formatAddress(deliveryAddress)}</Text>
              </Box>
              {onEditAddress && (
                <Button size="sm" variant="outline" onClick={onEditAddress}>
                  Change
                </Button>
              )}
            </HStack>

            <HStack gap={3}>
              <Icon as={FiCalendar} />
              <Box flex="1">
                <Text fontSize="sm" color="fg.muted">
                  Delivery date
                </Text>
                <Text>{formatDate(deliveryDate)}</Text>
              </Box>
            </HStack>

            <HStack gap={3}>
              <Icon as={FiClock} />
              <Box flex="1">
                <Text fontSize="sm" color="fg.muted">
                  Shift
                </Text>
                <Text>{shiftName ?? "—"}</Text>
              </Box>
            </HStack>
          </Stack>
        </Card.Body>
      </Card.Root>

      {/* Items */}
      <Card.Root>
        <Card.Header pb={2}>
          <HStack gap={2}>
            <Icon as={FiTruck} />
            <Text fontWeight="semibold">Items</Text>
          </HStack>
        </Card.Header>
        <Card.Body pt={0}>
          {itemRows.length === 0 ? (
            <Text color="fg.muted">Your cart is empty.</Text>
          ) : (
            <ItemList rows={itemRows} />
          )}
        </Card.Body>
      </Card.Root>

      {/* Totals */}
      <Card.Root>
        <Card.Header pb={2}>
          <Text fontWeight="semibold">Totals</Text>
        </Card.Header>
        <Card.Body pt={0}>
          <Stack gap={2}>
            <HStack justifyContent="space-between">
              <Text color="fg.muted">Items subtotal</Text>
              <Text>{formatCurrencyUSD(totals.subtotal)}</Text>
            </HStack>

            <HStack justifyContent="space-between">
              <Text color="fg.muted">Delivery fee</Text>
<Text>{appliedDelivery === 0 ? "Free" : formatCurrencyUSD(appliedDelivery)}</Text>
            </HStack>

     

            <HStack justifyContent="space-between">
              <Text color="fg.muted">Tax</Text>
              <Text>{formatCurrencyUSD(taxUsd)}</Text>
            </HStack>

            <Separator />

            <HStack justifyContent="space-between">
              <Text fontWeight="semibold">Total</Text>
              <Text fontWeight="semibold">{formatCurrencyUSD(totalPrice)}</Text>
            </HStack>
          </Stack>
        </Card.Body>
      </Card.Root>

      {/* Continue CTA */}
      <Box>
        <Button
          size="lg"
          onClick={onContinue}
          disabled={itemRows.length === 0}
          gap={2}
        >
          Continue to payment
          <Icon as={FiChevronRight} />
        </Button>
      </Box>
    </Stack>
  );
});

export default CheckoutSummary;

// local
function formatAddress(a: any): string {
  if (!a) return "—";
  if (typeof a === "string") return a || "—";
  const addr = a?.address ?? a?.fullAddress ?? a?.formatted ?? a?.label;
  return (addr && String(addr).trim()) || "—";
}
