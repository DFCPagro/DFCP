// src/components/common/ItemList.tsx
"use client";

import { Fragment } from "react";
import {
  Box,
  Grid,
  HStack,
  VStack,
  Text,
  Image,
  Badge,
  Button,
  Separator,
} from "@chakra-ui/react";

/** Local avatar for farm logos or initials. */
function AvatarBox({ url, text }: { url?: string; text?: string }) {
  const label = (text ?? "").trim() || "F";
  return url ? (
    <Image
      src={url}
      alt={label}
      boxSize="22px"
      borderRadius="full"
      borderWidth="1px"
      objectFit="cover"
    />
  ) : (
    <Box
      boxSize="22px"
      borderRadius="full"
      borderWidth="1px"
      bg="bg.muted"
      display="flex"
      alignItems="center"
      justifyContent="center"
      fontSize="10px"
      fontWeight="bold"
    >
      {label.slice(0, 2).toUpperCase()}
    </Box>
  );
}

function initials(...parts: Array<string | null | undefined>): string {
  const s = parts.filter(Boolean).join(" ").trim();
  if (!s) return "F";
  const p = s.split(/\s+/);
  return `${p[0]?.[0] ?? "F"}${p[1]?.[0] ?? ""}`.toUpperCase();
}

/** Row shape consumed here. */
export type ItemRow = {
  id?: string;
  title: string;
  subtitle?: string;

  imageUrl?: string;

  // farm branding
  farmLogo?: string | null;
  farmName?: string | null;

  // tagging
  category?: string;

  // numbers used to compute ≈metrics
  /** price per KG */
  pricePerUnit?: number;
  /** 'kg' | 'unit' | 'mixed' (informational) */
  unitMode?: "kg" | "unit" | "mixed";
  qtyKg?: number;
  qtyUnits?: number;
  /** average weight per unit, in KG */
  avgWeightPerUnitKg?: number;
  availableUnitsEstimate?: number;

  // optional currency hint
  currencySymbol?: string;

  [k: string]: any;
};

type Props = {
  rows?: ItemRow[];
  items?: ItemRow[];
  onRowClick?: (row: ItemRow) => void;
  onScanClick?: (row: ItemRow) => void;
  showScanButton?: boolean;
};

export default function ItemList({
  rows,
  items,
  onRowClick,
  onScanClick,
  showScanButton = false,
}: Props) {
  const data = (rows ?? items ?? []) as ItemRow[];

  return (
    <VStack w="full" align="stretch" gap={0}>
      {data.map((row, index) => {
        const key =
          row.id ??
          (row as any).lineId ??
          (row as any).stockId ??
          (row as any).docId ??
          String(index);

        const currency = row.currencySymbol ?? "₪";

        // ---------- derive metrics ----------
        const avg = num(row.avgWeightPerUnitKg);
        const pricePerKg = num(row.pricePerUnit); // per KG
        const displayPerKg = pricePerKg > 0 ? round2(pricePerKg) : undefined;

        // derive a *per unit* price only if we know avg weight
        const pricePerUnit =
          pricePerKg > 0 && avg > 0 ? round2(pricePerKg * avg) : undefined;

        const units =
          intUndef(row.availableUnitsEstimate) ??
          intUndef(row.qtyUnits) ??
          (avg > 0 && Number.isFinite(row.qtyKg)
            ? Math.round(num(row.qtyKg) / avg)
            : undefined);

        const kg =
          Number.isFinite(row.qtyKg)
            ? round1(num(row.qtyKg))
            : units && avg > 0
            ? round1(units * avg)
            : undefined;

        // effective kg for total
        const effKg =
          (Number.isFinite(row.qtyKg) ? num(row.qtyKg) : 0) +
          (typeof units === "number" && avg > 0 ? units * avg : 0);
        const total =
          pricePerKg > 0 && effKg > 0 ? round2(pricePerKg * effKg) : undefined;

        const qtyLine = [
          kg !== undefined ? `≈ ${kg} kg` : null,
          typeof units === "number" ? `≈ ${units} units` : null,
        ]
          .filter(Boolean)
          .join("  •  ");

        const priceLine = [
          displayPerKg !== undefined ? `≈ ${currency}${displayPerKg}/kg` : null,
          pricePerUnit !== undefined ? `${currency}${pricePerUnit}/unit` : null,
        ]
          .filter(Boolean)
          .join("  •  ");

        const totalLine =
          total !== undefined ? `≈ ${currency}${total} total` : "";

        return (
          <Fragment key={key}>
            {/* Card-like row */}
            <Grid
              templateColumns={{ base: "80px 1fr", md: "96px 1fr 240px" }}
              gap={3}
              p={3}
              borderRadius="lg"
              _hover={{
                bg: "bg.subtle",
                cursor: onRowClick ? "pointer" : "default",
              }}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {/* product image */}
              {row.imageUrl ? (
                <Image
                  src={row.imageUrl}
                  alt={row.title}
                  boxSize={{ base: "80px", md: "96px" }}
                  borderRadius="md"
                  objectFit="cover"
                  borderWidth="1px"
                />
              ) : (
                <Box
                  boxSize={{ base: "80px", md: "96px" }}
                  borderRadius="md"
                  borderWidth="1px"
                  bg="bg.muted"
                />
              )}

              {/* main info */}
              <VStack align="start" gap={1} minW={0}>
                <Text fontWeight="semibold" lineClamp={1}>
                  {row.title}
                </Text>

                {/* logo next to farmer/farm name */}
                {(row.subtitle || row.farmName || row.farmLogo) && (
                  <HStack gap={2} align="center" w="full" minW={0}>
                    <AvatarBox
                      url={row.farmLogo ?? undefined}
                      text={initials(row.farmName, row.subtitle, row.title)}
                    />
                    <Text fontSize="sm" color="fg.muted" lineClamp={1}>
                      {row.subtitle ?? row.farmName ?? ""}
                    </Text>
                  </HStack>
                )}

                <HStack gap={2} wrap="wrap">
                  {row.category ? <Badge>{row.category}</Badge> : null}
                </HStack>
              </VStack>

              {/* metrics pane */}
              <VStack
                display={{ base: "none", md: "flex" }}
                align="end"
                justify="center"
                gap={1}
              >
                <Text fontSize="sm" color="fg.muted">
                  {qtyLine || "—"}
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  {priceLine || "—"}
                </Text>
                <Text fontSize="sm" fontWeight="semibold">
                  {totalLine || " "}
                </Text>

                {showScanButton ? (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onScanClick?.(row);
                    }}
                  >
                    Scan
                  </Button>
                ) : null}
              </VStack>

              {/* small-screen metrics below text */}
              <Box
                gridColumn={{ base: "1 / -1", md: "auto" }}
                display={{ md: "none" }}
              >
                <Text fontSize="sm" color="fg.muted">
                  {qtyLine || "—"}
                </Text>
                <Text fontSize="sm" color="fg.muted">
                  {priceLine || "—"}
                </Text>
                <Text fontSize="sm" fontWeight="semibold">
                  {totalLine || " "}
                </Text>
              </Box>
            </Grid>

            <Separator />
          </Fragment>
        );
      })}
    </VStack>
  );
}

// ---------- helpers ----------
function num(v?: number | string | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function intUndef(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : undefined;
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
