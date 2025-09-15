import { Drawer, Portal } from "@chakra-ui/react"
import { X } from "lucide-react"
import ItemForm from "./ItemForm"
import { StyledIconButton } from "@/components/ui/IconButton"

type Props = {
  open: boolean
  setOpen: (val: boolean) => void
  isSubmitting: boolean
  onSubmit: (values: any) => Promise<void> | void
}

export default function AddItemDrawer({ open, setOpen, isSubmitting, onSubmit }: Props) {
  return (
    <Drawer.Root open={open} onOpenChange={({ open }) => setOpen(open)} size="md">
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header display="flex" alignItems="center" justifyContent="space-between">
              Create Item
              <Drawer.CloseTrigger asChild>
                <StyledIconButton aria-label="Close drawer" variant="ghost" size="sm">
                  <X size={16} />
                </StyledIconButton>
              </Drawer.CloseTrigger>
            </Drawer.Header>
            <Drawer.Body>
              <ItemForm mode="create" isSubmitting={isSubmitting} onSubmit={onSubmit} />
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}
