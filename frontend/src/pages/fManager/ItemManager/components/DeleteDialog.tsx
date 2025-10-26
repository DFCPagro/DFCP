import { Button, Dialog, Portal } from "@chakra-ui/react"
import type { Item } from "@/types/items"
import StyledButton from "@/components/ui/Button"

type Props = {
  open: boolean
  setOpen: (val: boolean) => void
  item: Item | null
  isLoading?: boolean
  onConfirm: () => void
}

export default function DeleteDialog({ open, setOpen, item, onConfirm, isLoading }: Props) {
  return (
    <Dialog.Root role="alertdialog" open={open} onOpenChange={({ open }) => setOpen(open)}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>Delete Item</Dialog.Header>
            <Dialog.Body>
              Are you sure you want to delete{" "}
              <b>
                {item?.type}
                {item?.variety ? ` ${item.variety}` : ""}
              </b>
              ? This action cannot be undone.
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <StyledButton visual="danger" ml={3} loading={isLoading} onClick={onConfirm}>
                Delete
              </StyledButton>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
