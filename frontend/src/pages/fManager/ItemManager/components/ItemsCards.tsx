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
import { Eye, Pencil, Trash2 } from "lucide-react";
import type { ItemsTableProps } from "../types";
import { StyledIconButton } from "@/components/ui/IconButton";
import ViewItemDrawer from "./ViewItemDrawer";
import { Tooltip } from "@/components/ui/tooltip";

function fmtUpdatedAt(date?: string | null) {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleString();
  } catch {
    return "-";
  }
}

const categoryColor: Record<string, string> = {
  fruit: "pink",
  vegetable: "teal",
  dairy: "blue",
  breads: "orange",
  legumes: "purple",
};

export default function ItemsCards({
  items,
  isBusy,
  onEdit,
  onDelete,
}: ItemsTableProps) {
  const view = useDisclosure();
  const [selected, setSelected] = React.useState<(typeof items)[number] | null>(null);

  return (
    <Box pos="relative">
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
        {items.map((it) => (
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
              {/* overlay gradient for readability */}
              <Box
                position="absolute"
                inset="0"
                bg="linear-gradient(0deg, rgba(0,0,0,0.45), transparent 55%)"
              />
              {/* Quick view button */}
              <Button
                size="xs"
                position="absolute"
                right="3"
                bottom="3"
                variant="solid"
                colorPalette="teal"
                borderRadius="full"
                onClick={() => {
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
                <Text fontWeight="semibold" fontSize="lg" lineClamp={1}>
                  {it.variety?.trim() ? `${it.type} ${it.variety}` : it.type}
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
                </HStack>
              </Stack>

              {/* Meta */}
              <Stack gap="1" fontSize="sm">
                {it.price && (
                  <HStack gap="2" wrap="wrap" align="center">
                    <Text fontWeight="medium">Price/Qul</Text>
                    <Badge variant="surface">{it.price.a ?? "-"}$/A</Badge>
                    <Badge variant="surface">{it.price.b ?? "-"}$/B</Badge>
                    <Badge variant="surface">{it.price.c ?? "-"}$/C</Badge>
                  </HStack>
                )}

                <HStack gap="2" color="fg.muted">
                  {it.caloriesPer100g != null && (
                    <Tooltip content="Calories per 100g">
                      <Text>Cal {it.caloriesPer100g}</Text>
                    </Tooltip>
                  )}
                  <Text fontSize="xs" ml="auto">
                    {fmtUpdatedAt(it.updatedAt)}
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
                onClick={() => onEdit(it)}
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
        ))}

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

      <ViewItemDrawer open={view.open} setOpen={view.setOpen} item={selected} />
    </Box>
  );
}
