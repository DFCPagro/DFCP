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
import { StyledIconButton } from "@/components/ui/IconButton"

type Props = {
  open: boolean
  setOpen: (val: boolean) => void
  isSubmitting: boolean
  onSubmit: (values: any) => Promise<void> | void
}

export default function AddItemDrawer({
  open,
  setOpen,
  isSubmitting,
  onSubmit,
}: Props) {
  // focus first meaningful input when opening (same approach as Edit drawer)
  const initialFocusEl = React.useCallback(() => {
    return (
      (document.querySelector('input[placeholder="e.g. Apple"]') as HTMLElement) ||
      (document.querySelector("input,select,textarea") as HTMLElement) ||
      null
    )
  }, [])

  return (
    <Drawer.Root
      open={open}
      onOpenChange={({ open }) => setOpen(open)}
      size="full"               // match Edit drawer
      placement="end"
      restoreFocus
      preventScroll
      closeOnEscape={!isSubmitting}
      closeOnInteractOutside={!isSubmitting}
      initialFocusEl={initialFocusEl}
    >
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            {/* Header matches Edit drawer style */}
            <Drawer.Header
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              gap="3"
            >
              <Stack gap="0">
                <HStack gap="2" align="baseline">
                  <Text fontSize="lg" fontWeight="semibold">
                    Create Item
                  </Text>
                  {/* optional badge to hint context */}
                  <Badge variant="subtle">New</Badge>
                </HStack>
                <HStack gap="2" color="fg.muted" fontSize="xs">
                  <Text>Fill all required fields</Text>
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

            {/* Body: re-mount form on each open to start fresh */}
            <Drawer.Body>
              <ItemForm
                key={open ? "create-open" : "create-closed"}
                mode="create"
                isSubmitting={isSubmitting}
                // you can omit defaultValues — ItemForm has sensible defaults
                // leaving this commented as documentation:
                // defaultValues={{
                //   category: "fruit",
                //   type: "",
                //   variety: "",
                //   imageUrl: "",
                //   caloriesPer100g: undefined,
                //   price: { a: null, b: null, c: null },
                // }}
                onSubmit={onSubmit}
              />
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}
