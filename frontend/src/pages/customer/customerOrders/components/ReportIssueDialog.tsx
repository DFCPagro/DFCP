"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  Field,
  Input,
  Textarea,
  HStack,
  VStack,
  Separator,
  Portal,
} from "@chakra-ui/react";

type Props = {
  open: boolean;
  onClose: () => void;
  orderId: string | number;
  /** Optional hook for integration */
  onSubmit?: (payload: { orderId: string | number; subject: string; details: string }) => Promise<void> | void;
};

/**
 * Always-on-top dialog for reporting issues.
 * Uses a Portal with extremely high z-index to sit above any app layers.
 */
export default function ReportIssueDialog({ open, onClose, orderId, onSubmit }: Props) {
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await (onSubmit?.({ orderId, subject: subject.trim(), details: details.trim() }) ?? Promise.resolve());
      onClose();
      setSubject("");
      setDetails("");
    } finally {
      setSubmitting(false);
    }
  }

  // Ultra-high z-index for both Backdrop and Positioner
  const Z_BACKDROP = 2147483646; // 2^31-2
  const Z_CONTENT = 2147483647;  // 2^31-1

  return (
    <Dialog.Root open={open} onOpenChange={(e) => (!e.open ? onClose() : null)}>
      <Portal>
        <Dialog.Backdrop style={{ zIndex: Z_BACKDROP }} />
        <Dialog.Positioner style={{ zIndex: Z_CONTENT }}>
          <Dialog.Content maxW="lg" borderRadius="xl">
            <Dialog.Header>
              Report an issue
              <Dialog.CloseTrigger />
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="stretch" gap={4}>
                <Field.Root>
                  <Field.Label>Order</Field.Label>
                  <Input value={String(orderId)} readOnly />
                </Field.Root>
                <Field.Root>
                  <Field.Label>Subject</Field.Label>
                  <Input
                    placeholder="Short summary"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </Field.Root>
                <Field.Root>
                  <Field.Label>Details</Field.Label>
                  <Textarea
                    rows={5}
                    placeholder="Describe the issue"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                  />
                </Field.Root>
              </VStack>
            </Dialog.Body>
            <Separator />
            <Dialog.Footer>
              <HStack justify="end" gap={2} w="full">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button
                  colorPalette="red"
                  onClick={handleSubmit}
                  disabled={submitting || (!subject.trim() && !details.trim())}
                >
                  {submitting ? "Submitting..." : "Submit report"}
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
