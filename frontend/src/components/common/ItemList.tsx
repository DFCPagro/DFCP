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


/** Sizes: product image and avatar keep a 3:1 ratio */
const IMG_SIZE = { base: 96, md: 112 };
const AVA_SIZE = {
  base: `${Math.round(IMG_SIZE.base * 0.5)}px`,  // 48px
  md: `${Math.round(IMG_SIZE.md * 0.5)}px`,      // 56px
};
const AVA_FONT = {
  base: `${Math.round(IMG_SIZE.base * 0.5 * 0.45)}px`,
  md: `${Math.round(IMG_SIZE.md * 0.5 * 0.45)}px`,
};

/** Local avatar for farm logos or initials. */
function AvatarBox({
  url,
  text,
  size,
  fontSize,
}: {
  url?: string;
  text?: string;
  size: any; // responsive boxSize object
  fontSize: any; // responsive fontSize object
}) {
  const label = (text ?? "").trim() || "F";
  return url ? (
    <Image
      src={url}
      alt={label}
      boxSize={size}
      borderRadius="full"
      borderWidth="1px"
      objectFit="cover"
    />
  ) : (
    <Box
      boxSize={size}
      borderRadius="full"
      borderWidth="1px"
      bg="bg.muted"
      display="flex"
      alignItems="center"
      justifyContent="center"
      fontSize={fontSize}
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
  pricePerUnit?: number; // per KG
  /** optional price per EACH unit if item is priced per unit */
  pricePerUnitEach?: number;

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
          
          (row as any).stockId ??
          (row as any).docId ??
          String(index);

        const currency = row.currencySymbol ?? "₪";

        // ---------- inputs ----------
        const avg = nz(num(row.avgWeightPerUnitKg)); // kg per unit
        const pricePerKg = nz(num(row.pricePerUnit));
        const explicitEach = nz(num((row as any).pricePerUnitEach));
        const priceEach =
          explicitEach > 0
            ? explicitEach
            : avg > 0 && pricePerKg > 0
            ? round2(pricePerKg * avg)
            : 0;

        const qtyKgRaw = isNum(row.qtyKg) ? num(row.qtyKg) : undefined;
        const qtyUnitsRaw = isNum(row.qtyUnits) ? Math.round(num(row.qtyUnits)) : undefined;

        // ---------- display metrics ----------
        const kgDisplay =
          qtyKgRaw !== undefined
            ? round1(qtyKgRaw)
            : qtyUnitsRaw !== undefined && avg > 0
            ? round1(qtyUnitsRaw * avg)
            : undefined;

        const unitsDisplay =
          intUndef(row.availableUnitsEstimate) ??
          (qtyUnitsRaw !== undefined
            ? qtyUnitsRaw
            : qtyKgRaw !== undefined && avg > 0
            ? Math.round(qtyKgRaw / avg)
            : undefined);

        const pricePerKgDisplay = pricePerKg > 0 ? round2(pricePerKg) : undefined;
        const pricePerUnitDisplay = priceEach > 0 ? round2(priceEach) : undefined;

        const qtyLine = [
          kgDisplay !== undefined ? `≈ ${kgDisplay} kg` : null,
          unitsDisplay !== undefined ? `≈ ${unitsDisplay} units` : null,
        ]
          .filter(Boolean)
          .join("  •  ");

        const priceLine = [
          pricePerKgDisplay !== undefined ? `≈ ${currency}${pricePerKgDisplay}/kg` : null,
          pricePerUnitDisplay !== undefined ? `${currency}${pricePerUnitDisplay}/unit` : null,
        ]
          .filter(Boolean)
          .join("  •  ");

        // ---------- TOTAL (no double counting) ----------
        const totalFromKg = pricePerKg > 0 && qtyKgRaw !== undefined ? pricePerKg * qtyKgRaw : 0;

        const totalFromUnits =
          qtyUnitsRaw !== undefined
            ? priceEach > 0
              ? priceEach * qtyUnitsRaw
              : pricePerKg > 0 && avg > 0
              ? pricePerKg * (qtyUnitsRaw * avg)
              : 0
            : 0;

        const totalRaw = totalFromKg + totalFromUnits;
        const total = totalRaw > 0 ? round2(totalRaw) : undefined;
        const totalLine = total !== undefined ? `${currency}${total}` : "";

        return (
          <Fragment key={key}>
            {/* Card-like row */}
            <Grid
              templateColumns={{ base: "96px 1fr", md: "112px 2fr 2fr" }}
              gap={{ base: 3, md: 4 }}
              p={{ base: 4, md: 5 }}
              borderRadius="xl"
              borderWidth="1px"
              bg="bg.canvas"
              _hover={{
                bg: "bg.subtle",
                shadow: "sm",
                cursor: onRowClick ? "pointer" : "default",
              }}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {/* product image */}
              {row.imageUrl ? (
                <Image
                  src={row.imageUrl}
                  alt={row.title}
                  boxSize={{ base: `${IMG_SIZE.base}px`, md: `${IMG_SIZE.md}px` }}
                  borderRadius="lg"
                  objectFit="cover"
                  borderWidth="1px"
                />
              ) : (
                <Box
                  boxSize={{ base: `${IMG_SIZE.base}px`, md: `${IMG_SIZE.md}px` }}
                  borderRadius="lg"
                  borderWidth="1px"
                  bg="bg.muted"
                />
              )}

              {/* main info */}
              <VStack align="start" gap={{ base: 2, md: 3 }} minW={0}>
                <Text
                  fontWeight="bold"
                  fontSize={{ base: "lg", md: "xl" }}
                  lineHeight="1.2"
                  lineClamp={1}
                >
                  {row.title}
                </Text>

                {/* logo next to farmer/farm name, 1/3 of image size */}
                {(row.subtitle || row.farmName || row.farmLogo) && (
                  <HStack gap={2} align="center" w="full" minW={0}>
                    <AvatarBox
                      url={row.farmLogo ?? undefined}
                      text={initials(row.farmName, row.subtitle, row.title)}
                      size={AVA_SIZE}
                      fontSize={AVA_FONT}
                    />
                    <Text
                      fontSize={{ base: "sm", md: "md" }}
                      color="fg.muted"
                      lineClamp={1}
                    >
                      {row.subtitle ?? row.farmName ?? ""}
                    </Text>
                  </HStack>
                )}

                <HStack gap={2} wrap="wrap">
                  {row.category ? (
                    <Badge px="2" py="0.5" fontSize={{ base: "xs", md: "sm" }} borderRadius="md">
                      {row.category}
                    </Badge>
                  ) : null}
                </HStack>
              </VStack>

              {/* metrics pane */}
              <VStack
                display={{ base: "none", md: "flex" }}
                align="stretch"
                justify="center"
                gap={1}
                fontVariantNumeric="tabular-nums"
              >
                <HStack justify="space-between">
                  <Text color="fg.muted" fontSize="xl">
                    Qty {qtyLine || "—"}
                  </Text>
                </HStack>

                <HStack justify="space-between">
                  <Text color="fg.muted" fontSize="xl">
                    Price {priceLine || "—"}
                  </Text>
                  <Text fontSize="xl" fontWeight="extrabold">
                    Total {totalLine || " "}
                  </Text>
                </HStack>

        

                {showScanButton ? (
                  <Button
                    size="sm"
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

              {/* small-screen metrics */}
              <Box
                gridColumn={{ base: "1 / -1", md: "auto" }}
                display={{ md: "none" }}
                fontVariantNumeric="tabular-nums"
              >
                <VStack align="stretch" gap={1.5}>
                  <HStack justify="space-between">
                    <Text color="fg.muted" fontSize="xs">
                      Qty 
                    </Text>
                    <Text fontSize="md">{qtyLine || "—"}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="fg.muted" fontSize="xs">
                      Price
                    </Text>
                    <Text fontSize="md">{priceLine || "—"}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="fg.muted" fontSize="xs">
                      Total
                    </Text>
                    <Text fontSize="xl" fontWeight="extrabold">
                      {totalLine || " "}
                    </Text>
                  </HStack>
                </VStack>
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
  return Number.isFinite(n) ? n : NaN;
}
function nz(n: number) {
  return Number.isFinite(n) ? n : 0;
}
function isNum(v: unknown): boolean {
  const n = Number(v);
  return Number.isFinite(n);
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
