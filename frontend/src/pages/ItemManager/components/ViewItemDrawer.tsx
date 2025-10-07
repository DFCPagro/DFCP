import * as React from "react"
import {
  Badge,
  Drawer,
  HStack,
  Kbd,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react"
import { X } from "lucide-react"
import ItemForm from "./ItemForm"
import type { Item } from "@/types/items"
import { StyledIconButton } from "@/components/ui/IconButton"

type Props = {
  open: boolean
  setOpen: (val: boolean) => void
  item: Item | null
}

/** Read-only drawer to view an item's full details. */
export default function ViewItemDrawer({ open, setOpen, item }: Props) {
  const title = React.useMemo(() => {
    if (!item) return "Item details"
    const v = (item.variety ?? "").trim()
    return v ? `${item.type} ${v}` : item.type
  }, [item])

  const category = item?.category
  const updated = item?.updatedAt
    ? new Date(item.updatedAt).toLocaleString()
    : null

  const initialFocusEl = React.useCallback(() => {
    return (
      (document.querySelector('button[aria-label="Close drawer"]') as HTMLElement) ||
      null
    )
  }, [])

  return (
    <Drawer.Root
      open={open}
      onOpenChange={({ open }) => setOpen(open)}
      size="full"
      placement="end"
      restoreFocus
      preventScroll
      closeOnEscape
      closeOnInteractOutside
      initialFocusEl={initialFocusEl}
    >
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              gap="3"
            >
              <Stack gap="0">
                <HStack gap="2" align="baseline">
                  <Text fontSize="lg" fontWeight="semibold">
                    {title}
                  </Text>
                  {category && <Badge>{category}</Badge>}
                </HStack>
                <HStack gap="2" color="fg.muted" fontSize="xs">
                  {updated && <Text>Last updated: {updated}</Text>}
                  <HStack gap="1" hideBelow="md">
                    <Text>Press</Text>
                    <Kbd>Esc</Kbd>
                    <Text>to close</Text>
                  </HStack>
                </HStack>
              </Stack>

              <Drawer.CloseTrigger asChild>
                <StyledIconButton
                  aria-label="Close drawer"
                  variant="ghost"
                  size="sm"
                >
                  <X size={16} />
                </StyledIconButton>
              </Drawer.CloseTrigger>
            </Drawer.Header>

            <Drawer.Body>
              {item ? (
                <ItemForm
                  key={item._id ?? "view-form"}
                  mode="edit"
                  readOnly
                  defaultValues={{
                    category: item.category,
                    type: item.type,
                    variety: item.variety ?? "",
                    imageUrl: item.imageUrl ?? "",
                    caloriesPer100g: item.caloriesPer100g ?? undefined,
                    price: item.price ?? { a: null, b: null, c: null },
                    season: item.season ?? "",
                    tolerance: item.tolerance ?? "",
                    qualityStandards: item.qualityStandards ?? undefined,
                  }}
                  // onSubmit is unused in readOnly; provide a noop
                  onSubmit={() => {}}
                />
              ) : (
                <Text color="fg.muted">No item selected</Text>
              )}
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}
