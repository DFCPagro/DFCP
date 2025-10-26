import * as React from "react"
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
} from "@chakra-ui/react"
import { Eye, Pencil, Trash2 } from "lucide-react"
import type { ItemsTableProps } from "../types"
import { StyledIconButton } from "@/components/ui/IconButton"
import ViewItemDrawer from "./ViewItemDrawer"
import { Tooltip } from "@/components/ui/tooltip"

function fmtUpdatedAt(date?: string | null) {
  if (!date) return "-"
  try {
    return new Date(date).toLocaleString()
  } catch {
    return "-"
  }
}

function fmtPrice(p?: { a?: number | null; b?: number | null; c?: number | null }) {
  if (!p) return "-"
  const parts = [p.a, p.b, p.c].map((v) => (v == null ? "-" : v))
  return `A ${parts[0]} · B ${parts[1]} · C ${parts[2]}`
}

function Title({ type, variety }: { type: string; variety?: string | null }) {
  const v = (variety ?? "").trim()
  return (
    <Text fontWeight="semibold" fontSize="lg" lineClamp={1}>
      {v ? `${type} ${v}` : type}
    </Text>
  )
}

export default function ItemsCards({
  items,
  isBusy,
  onEdit,
  onDelete,
}: ItemsTableProps) {
  const view = useDisclosure()
  const [selected, setSelected] = React.useState<(typeof items)[number] | null>(null)

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
            _hover={{ translateY: "-2px", shadow: "lg" }}
            transition="all 0.15s ease"
          >
            {/* Media */}
            <Box bg="blackAlpha.50" position="relative">
              <Image
                src={it.imageUrl || "https://picsum.photos/640/400?grayscale"}
                alt={`${it.type}${it.variety ? ` ${it.variety}` : ""}`}
                w="full"
                h="172px"
                objectFit="cover"
              />
              {/* quick-view fab on image for better affordance */}
              <Button
                size="xs"
                // leftIcon={<Eye size={14} />}
                position="absolute"
                right="2"
                bottom="2"
                variant="solid"
                onClick={() => {
                  setSelected(it)
                  view.onOpen()
                }}
              >
                <Eye size={14} />
                View
              </Button>
            </Box>

            {/* Body */}
            <Card.Body gap="3">
              <Stack gap="1" flex="1" minW="0">
                <Title type={it.type} variety={it.variety} />
                <HStack gap="2" wrap="wrap">
                  <Badge variant="surface">{it.category}</Badge>
                  {it.season && <Badge variant="subtle">{it.season}</Badge>}
                </HStack>
              </Stack>

              {/* Compact meta row */}
              <Stack gap="1" fontSize="sm">
                {it.price && (
                  <HStack gap="2" wrap="wrap">
                    <Text fontWeight="medium">Price</Text>
                    <Badge variant="subtle">A {it.price.a ?? "-"}</Badge>
                    <Badge variant="subtle">B {it.price.b ?? "-"}</Badge>
                    <Badge variant="subtle">C {it.price.c ?? "-"}</Badge>
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

            {/* Footer with actions */}
            <Card.Footer justifyContent="flex-end" gap="1">
              <StyledIconButton
                size="xs"
                variant="subtle"
                aria-label="Edit"
                onClick={() => onEdit(it)}
              >
                <Pencil size={16} />
              </StyledIconButton>
              <StyledIconButton
                size="xs"
                variant="subtle"
                colorPalette="red"
                aria-label="Delete"
                onClick={() => onDelete(it)}
              >
                <Trash2 size={16} />
              </StyledIconButton>
            </Card.Footer>
          </Card.Root>
        ))}

        {items.length === 0 && !isBusy && (
          <Card.Root variant="subtle">
            <Card.Body alignItems="center" textAlign="center">
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
  )
}
