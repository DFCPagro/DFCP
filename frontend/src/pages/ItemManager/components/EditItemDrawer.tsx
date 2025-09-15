import { Drawer, Portal } from "@chakra-ui/react";
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
  return (
    <Drawer.Root
      open={open}
      onOpenChange={({ open }) => {
        setOpen(open);
      }}
      size="md"
    >
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header
              display="flex"
              alignItems="center"
              justifyContent="space-between"
            >
              Edit Item
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
              <ItemForm
                key={editing?._id ?? "edit-form"}
                mode="edit"
                isSubmitting={isSubmitting}
                defaultValues={
                  editing
                    ? {
                        category: editing.category,
                        type: editing.type,
                        variety: editing.variety ?? undefined,
                        imageUrl: editing.imageUrl ?? undefined,
                        caloriesPer100g: editing.caloriesPer100g ?? undefined,
                        price: editing.price ?? { a: null, b: null, c: null },
                      }
                    : undefined
                }
                onSubmit={onSubmit}
              />
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
