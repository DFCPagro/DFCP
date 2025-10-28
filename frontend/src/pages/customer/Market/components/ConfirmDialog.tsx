import { memo, useCallback, useRef, useState } from "react";
import { Button, Dialog, Portal } from "@chakra-ui/react";
import type { ReactNode } from "react";

export type ConfirmDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  body?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isWorking?: boolean;
  destructive?: boolean;
  disableCancel?: boolean;
  autoCloseOnConfirm?: boolean; // new
};

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
  autoCloseOnConfirm = true,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    if (isWorking || submitting) return;
    onClose();
  }, [isWorking, submitting, onClose]);

  const handleConfirm = useCallback(async () => {
    if (isWorking || submitting) return;
    setSubmitting(true);
    try {
      await Promise.resolve(onConfirm());
      if (autoCloseOnConfirm) onClose();
    } finally {
      setSubmitting(false);
    }
  }, [isWorking, submitting, onConfirm, autoCloseOnConfirm, onClose]);

  return (
    <Dialog.Root
      role="alertdialog"
      open={isOpen}
      onOpenChange={(e) => {
        if (!e.open) handleClose();
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
                  disabled={disableCancel || isWorking || submitting}
                >
                  {cancelLabel}
                </Button>
              </Dialog.ActionTrigger>

              <Button
                colorPalette={destructive ? "red" : "teal"}
                onClick={handleConfirm}
                loading={isWorking || submitting}
                ms="3"
              >
                {confirmLabel}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

export const ConfirmDialog = memo(ConfirmDialogBase);
