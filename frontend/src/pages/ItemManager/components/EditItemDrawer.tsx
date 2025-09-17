// src/pages/items/components/EditItemDrawer.tsx
import * as React from "react";
import {
  Badge,
  Box,
  Drawer,
  HStack,
  Kbd,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import { X } from "lucide-react";
import ItemForm from "./ItemForm";
import type { Item } from "@/types/items";
import { StyledIconButton } from "@/components/ui/IconButton";

type Props = {
  open: boolean;
  setOpen: (val: boolean) => void;
  editing: Item | null;
  isSubmitting: boolean;
  onSubmit: (values: any) => Promise<void> | void;
};

export default function EditItemDrawer({
  open,
  setOpen,
  editing,
  isSubmitting,
  onSubmit,
}: Props) {
  // Build a nice title & subtitle from the editing item
  const title = React.useMemo(() => {
    if (!editing) return "Edit Item";
    const v = (editing.variety ?? "").trim();
    return v ? `${editing.type} ${v}` : editing.type;
  }, [editing]);

  const category = editing?.category;
  const updated = editing?.updatedAt
    ? new Date(editing.updatedAt).toLocaleString()
    : null;

  // Focus the first editable input when opening
  const initialFocusEl = React.useCallback(() => {
    // Try “Type” first, fall back to any input
    return (
      (document.querySelector(
        'input[placeholder="e.g. Apple"]'
      ) as HTMLElement) ||
      (document.querySelector("input,select,textarea") as HTMLElement) ||
      null
    );
  }, []);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={({ open }) => setOpen(open)}
      size="lg"
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
            {/* Header */}
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

            {/* Body */}
            <Drawer.Body>
              {editing ? (
                <ItemForm
                  key={editing._id ?? "edit-form"}
                  mode="edit"
                  isSubmitting={isSubmitting}
                  defaultValues={{
                    category: editing.category,
                    type: editing.type,
                    variety: editing.variety ?? "",
                    imageUrl: editing.imageUrl ?? "",
                    caloriesPer100g: editing.caloriesPer100g ?? undefined,
                    price: editing.price ?? { a: null, b: null, c: null },

                    // Extras (you added these to editing defaults earlier)
                    season: editing.season ?? "",
                    tolerance: editing.tolerance ?? "",
                    qualityStandards: editing.qualityStandards ?? undefined,
                  }}
                  onSubmit={onSubmit}
                />
              ) : (
                <Box color="fg.muted">No item selected</Box>
              )}
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
