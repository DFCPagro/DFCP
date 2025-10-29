// src/pages/items/components/ItemsCards.tsx
import * as React from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  HStack,
  Image,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { Eye, Pencil, Trash2, Plus } from "lucide-react";
import type { ItemsTableProps } from "../types";
import { StyledIconButton } from "@/components/ui/IconButton";
import ViewItemDrawer from "./ViewItemDrawer";
import { Tooltip } from "@/components/ui/tooltip";

/* ---------------- helpers ---------------- */
function fmtUpdatedAt(date?: string | null) {
  if (!date) return "-";
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

const categoryColor: Record<string, string> = {
  fruit: "pink",
  vegetable: "teal",
  egg_dairy: "blue",
  other: "gray",
};

function titleFor(it: any) {
  const base = it?.variety?.trim() ? `${it.type} ${it.variety}` : it.type;
  const pack =
    it?.sellModes?.byUnit && (it.sellModes?.unitBundleSize ?? 1) > 1
      ? ` (${it.sellModes.unitBundleSize} pack)`
      : "";
  return `${base ?? ""}${pack}`;
}

function isProduce(cat?: string) {
  return cat === "fruit" || cat === "vegetable";
}

function fmtWeightPerUnit(it: any) {
  const g: number | undefined = it?.weightPerUnitG ?? it?.avgWeightPerUnitGr;
  if (!g || typeof g !== "number") return "";
  if (g >= 1000) return `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 1)} kg`;
  return `${g} g`;
}

type SellMode = "kg" | "unit" | "mixed";
function getSellMode(it: any): SellMode {
  const byKg = it?.sellModes?.byKg ?? true;
  const byUnit = it?.sellModes?.byUnit ?? false;
  if (byKg && byUnit) return "mixed";
  if (byUnit) return "unit";
  return "kg";
}

function sellBadgeLabel(it: any) {
  const mode = getSellMode(it);
  const bundle = it?.sellModes?.unitBundleSize ?? 1;
  const bundleTxt = mode === "unit" && bundle > 1 ? ` (${bundle})` : "";
  if (mode === "kg") return "Sell: kg";
  if (mode === "unit") return `Sell: unit${bundleTxt}`;
  return "Sell: mixed";
}

function sellBadgeColor(it: any) {
  const mode = getSellMode(it);
  if (mode === "kg") return "green";
  if (mode === "unit") return "cyan";
  return "purple";
}

function fmtPrice(p?: number | null) {
  if (p == null) return "-";
  return `$${p}`;
}

/* --------------- component ---------------- */
type ItemsCardsProps = Omit<ItemsTableProps, "onEdit"> & {
  onEdit?: (item: any, opts?: { editable?: boolean }) => void;
  onAddItem?: (opts?: { editable?: boolean }) => void;
};

export default function ItemsCards({
  items,
  isBusy,
  onEdit,
  onDelete,
  onAddItem,
}: ItemsCardsProps) {
  const view = useDisclosure();
  const [selected, setSelected] = React.useState<(typeof items)[number] | null>(
    null
  );
  const [editable, setEditable] = React.useState(false);

  return (
    <Box pos="relative">
    {onAddItem && (
  <HStack justify="flex-end" mb="3">
    <Button
      size="sm"
      onClick={() => onAddItem?.({ editable: true })}
      gap="1.5"
    >
      <Plus size={14} />
      Add item
    </Button>
  </HStack>
)}


      {isBusy && (
        <HStack
          pos="absolute"
          top="2"
          right="2"
          bg="bg"
          borderRadius="full"
          px="2"
          py="1"
          shadow="sm"
          zIndex={1}
          border="1px solid"
          borderColor="border"
        >
          <Spinner size="sm" />
          <Text fontSize="xs" color="fg.muted">
            Loading…
          </Text>
        </HStack>
      )}

      <SimpleGrid columns={{ base: 1, sm: 2, md: 3, xl: 4 }} gap="5">
        {items.map((it) => {
          const mode = getSellMode(it);
          const perUnitWeight =
            mode === "unit" && isProduce(it.category)
              ? fmtWeightPerUnit(it)
              : "";

          return (
            <Card.Root
              key={it._id}
              variant="elevated"
              overflow="hidden"
              borderRadius="2xl"
              border="1px solid"
              borderColor="border"
              _hover={{ translateY: "-3px", shadow: "xl" }}
              transition="transform 0.15s ease, box-shadow 0.15s ease"
            >
              {/* Media */}
              <Box position="relative" bg="bg.muted">
                <Image
                  src={it.imageUrl || "https://picsum.photos/640/400?grayscale"}
                  alt={`${it.type}${it.variety ? ` ${it.variety}` : ""}`}
                  w="full"
                  h="180px"
                  objectFit="cover"
                />
                <Box
                  position="absolute"
                  inset="0"
                  bg="linear-gradient(0deg, rgba(0,0,0,0.45), transparent 55%)"
                />
                <Button
                  size="xs"
                  position="absolute"
                  right="3"
                  bottom="3"
                  variant="solid"
                  colorPalette="teal"
                  borderRadius="full"
                  onClick={() => {
                    setEditable(false); // view => editable=false
                    setSelected(it);
                    view.onOpen();
                  }}
                  gap="1.5"
                >
                  <Eye size={14} />
                  View
                </Button>
              </Box>

              {/* Body */}
              <Card.Body gap="3">
                <Stack gap="1" flex="1" minW="0">
                  <Text
                    fontWeight="semibold"
                    fontSize="lg"
                    whiteSpace="normal"
                    wordBreak="break-word"
                    title={titleFor(it)}
                  >
                    {titleFor(it)}
                  </Text>

                  <HStack gap="2" wrap="wrap">
                    <Badge
                      variant="solid"
                      colorPalette={categoryColor[it.category ?? ""] || "gray"}
                    >
                      {it.category}
                    </Badge>

                    {it.season && (
                      <Badge variant="subtle" colorPalette="purple">
                        {it.season}
                      </Badge>
                    )}

                    <Badge variant="subtle" colorPalette={sellBadgeColor(it)}>
                      {sellBadgeLabel(it)}
                    </Badge>
                  </HStack>
                </Stack>

                <Stack gap="2" fontSize="sm">
                  {it.price && (
                    <HStack gap="2" wrap="wrap" align="center">
                      <Text fontWeight="medium">
                        {it.category === "egg_dairy" ? "Price" : "Price/Qual"}
                      </Text>

                      {it.category === "egg_dairy" ? (
                        <Badge variant="surface">{fmtPrice(it.price.a)}</Badge>
                      ) : (
                        <>
                          <Badge variant="surface">
                            {fmtPrice(it.price.a)} / A
                          </Badge>
                          <Badge variant="surface">
                            {fmtPrice(it.price.b)} / B
                          </Badge>
                          <Badge variant="surface">
                            {fmtPrice(it.price.c)} / C
                          </Badge>
                        </>
                      )}

                      {mode === "unit" &&
                        it.pricePerUnitOverride != null && (
                          <Tooltip content="Explicit per-unit price override">
                            <Badge variant="solid" colorPalette="gray">
                              {fmtPrice(it.pricePerUnitOverride)} / unit
                            </Badge>
                          </Tooltip>
                        )}
                    </HStack>
                  )}

                  <HStack gap="2" color="fg.muted" align="center">
                    {perUnitWeight && (
                      <Tooltip content="Approximate weight per unit">
                        <Text>Unit ~ {perUnitWeight}</Text>
                      </Tooltip>
                    )}
                    <Text fontSize="xs" ml="auto">
                      {fmtUpdatedAt(it.updatedAt ?? it.lastUpdated)}
                    </Text>
                  </HStack>
                </Stack>
              </Card.Body>

              {/* Footer */}
              <Card.Footer justifyContent="flex-end" gap="1.5">
                <StyledIconButton
                  size="xs"
                  variant="subtle"
                  aria-label="Edit"
                  onClick={() => onEdit?.(it, { editable: true })} // edit => true
                  title="Edit item"
                >
                  <Pencil size={16} />
                </StyledIconButton>
                <StyledIconButton
                  size="xs"
                  variant="subtle"
                  colorPalette="red"
                  aria-label="Delete"
                  onClick={() => onDelete(it)}
                  title="Delete item"
                >
                  <Trash2 size={16} />
                </StyledIconButton>
              </Card.Footer>
            </Card.Root>
          );
        })}

        {items.length === 0 && !isBusy && (
          <Card.Root variant="subtle" borderRadius="2xl">
            <Card.Body alignItems="center" textAlign="center" gap="2">
              <Text fontWeight="medium">No items found</Text>
              <Text color="fg.muted" fontSize="sm">
                Try adjusting filters or search.
              </Text>
            </Card.Body>
          </Card.Root>
        )}
      </SimpleGrid>

      <ViewItemDrawer
        open={view.open}
        setOpen={view.setOpen}
        item={selected}
        editable={editable}
      />
    </Box>
  );
}
