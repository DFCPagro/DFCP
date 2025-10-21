import {
  Button,
  Dialog,
  Field,
  Portal,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react"
import { useEffect, useMemo, useState } from "react"

export type RejectNoteDialogProps = {
  /** Controlled open/close from the parent */
  isOpen: boolean
  onClose: () => void

  /** Called when user confirms reject (note is trimmed and non-empty) */
  onSubmit: (note: string) => Promise<void> | void

  /** Optional UI context, e.g., item summary shown under the title */
  orderLabel?: string

  /** External loading state (e.g., mutation pending).
   * If omitted, the dialog will manage its own local pending state. */
  loading?: boolean

  /** Pre-fill note field if needed */
  initialNote?: string

  /** Optional server-side error to show (e.g., mutation error message) */
  errorMsg?: string | null
}

export default function RejectNoteDialog({
  isOpen,
  onClose,
  onSubmit,
  orderLabel,
  loading,
  initialNote = "",
  errorMsg,
}: RejectNoteDialogProps) {
  const [note, setNote] = useState<string>(initialNote)
  const [touched, setTouched] = useState(false)
  const [localPending, setLocalPending] = useState(false)

  const isPending = loading ?? localPending

  // Reset content each time it opens
  useEffect(() => {
    if (isOpen) {
      setNote(initialNote)
      setTouched(false)
      setLocalPending(false)
    }
  }, [isOpen, initialNote])

  const trimmed = useMemo(() => note.trim(), [note])
  const hasError = touched && trimmed.length === 0

  async function handleConfirm() {
    setTouched(true)
    if (trimmed.length === 0) return
    if (loading === undefined) setLocalPending(true)
    try {
      await onSubmit(trimmed)
      // If submission succeeds, close dialog
      onClose()
    } finally {
      if (loading === undefined) setLocalPending(false)
    }
  }

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(e) => {
        // Prevent accidental close while submitting
        if (!e.open && !isPending) onClose()
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="sm">
            <Dialog.Header>
              <Dialog.Title>Reject order</Dialog.Title>
            </Dialog.Header>

            <Dialog.CloseTrigger disabled={isPending} />

            <Dialog.Body>
              {orderLabel ? (
                <Text mb="3" color="fg.muted">
                  {orderLabel}
                </Text>
              ) : null}

              <Stack gap="3">
                <Field.Root invalid={hasError}>
                  <Field.Label>Reason / Note</Field.Label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onBlur={() => setTouched(true)}
                    placeholder="Explain the problem so we can adjust the plan…"
                    disabled={isPending}
                    rows={4}
                  />
                  {hasError ? (
                    <Field.ErrorText>Note is required.</Field.ErrorText>
                  ) : null}
                </Field.Root>

                {errorMsg ? (
                  <Text color="red.500" fontSize="sm">
                    {errorMsg}
                  </Text>
                ) : null}
              </Stack>
            </Dialog.Body>

            <Dialog.Footer>
              <Button variant="outline" onClick={onClose} disabled={isPending} mr="2">
                Cancel
              </Button>
              <Button
                colorPalette="red"
                onClick={handleConfirm}
                loading={isPending}
                disabled={isPending}
              >
                Reject
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
