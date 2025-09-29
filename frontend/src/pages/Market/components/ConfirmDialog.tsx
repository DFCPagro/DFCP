import { memo, useCallback, useRef } from "react"
import { Button, Dialog, Portal } from "@chakra-ui/react"
import type { ReactNode } from "react"

export type ConfirmDialogProps = {
  /** Controls visibility */
  isOpen: boolean
  /** Close the dialog (also used for the Cancel button) */
  onClose: () => void
  /** Called when Confirm is pressed (supports async) */
  onConfirm: () => void | Promise<void>

  /** Title at the top (default: "Are you sure?") */
  title?: string
  /** Body text/content. If not provided, children will be used. */
  body?: ReactNode
  /** Alternative to `body` */
  children?: ReactNode

  /** Confirm button label (default: "Confirm") */
  confirmLabel?: string
  /** Cancel button label (default: "Cancel") */
  cancelLabel?: string

  /** Show loading state on the confirm button (parent-controlled) */
  isWorking?: boolean

  /** If true, confirm button is red and indicates a destructive action */
  destructive?: boolean

  /** Disable the cancel button (default: false) */
  disableCancel?: boolean
}

function ConfirmDialogBase({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  body,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isWorking = false,
  destructive = false,
  disableCancel = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null)

  const handleClose = useCallback(() => {
    if (isWorking) return // block closing while working
    onClose()
  }, [isWorking, onClose])

  const handleConfirm = useCallback(async () => {
    await Promise.resolve(onConfirm())
  }, [onConfirm])

  return (
    <Dialog.Root
      role="alertdialog"
      open={isOpen}
      onOpenChange={(e) => {
        // only allow external close when not working
        if (!e.open) handleClose()
      }}
      initialFocusEl={() => cancelRef.current}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>

            <Dialog.Body>{body ?? children ?? null}</Dialog.Body>

            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button
                  ref={cancelRef}
                  variant="ghost"
                  disabled={disableCancel || isWorking}
                >
                  {cancelLabel}
                </Button>
              </Dialog.ActionTrigger>

              <Button
                colorPalette={destructive ? "red" : "teal"}
                onClick={handleConfirm}
                loading={isWorking}
                ms="3"
              >
                {confirmLabel}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}

export const ConfirmDialog = memo(ConfirmDialogBase)
