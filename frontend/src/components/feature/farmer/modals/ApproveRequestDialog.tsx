import { useEffect, useState } from "react";
import {
  Dialog,
  VStack,
  Text,
  Box,
  Button,
  HStack,
  Alert,
  NumberInput,
  Input,
} from "@chakra-ui/react";
import type { ShipmentRequest } from "@/types/farmer";
import { fmt } from "@/helpers/datetime";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  request: ShipmentRequest | null;
  onApproved: (approvedKg: number, validUntilISO: string) => void;
};

export default function ApproveRequestDialog({
  isOpen,
  onClose,
  request,
  onApproved,
}: Props) {
  const [approvedKg, setApprovedKg] = useState(0);
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 4 * 3600_000).toISOString().slice(0, 16)
  );

  useEffect(() => {
    if (!request) return;
    setApprovedKg(request.requestedKg);
    // default deadline = pickup - 30min (normalized to local datetime-local format)
    const d = new Date(new Date(request.pickupTimeISO).getTime() - 30 * 60000);
    setValidUntil(
      new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    );
  }, [request]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Approve Shipment Request</Dialog.Title>
        </Dialog.Header>

        <Dialog.Body>
          {request && (
            <VStack align="stretch" gap={3}>
              <Text>
                <b>Item:</b> {request.itemName}
              </Text>
              <Text>
                <b>Requested:</b> {request.requestedKg.toLocaleString()} kg
              </Text>
              <Text>
                <b>Pickup time:</b> {fmt(request.pickupTimeISO)}
              </Text>

              <Alert.Root status="info">
                <Alert.Title>Partial approval allowed</Alert.Title>
                <Alert.Description>
                  אם אינך יכול לספק את כל הכמות, אפשר לאשר כמות חלקית ולציין עד
                  מתי התשובה בתוקף.
                </Alert.Description>
              </Alert.Root>

              <Box>
                <Text mb={1}>I can supply (kg)</Text>
                <NumberInput.Root
                  min={0}
                  max={request.requestedKg}
                  value={String(approvedKg)}
                  // NOTE: v3 passes an object; cast to any to satisfy TS across patch versions
                  onValueChange={(v: any) => setApprovedKg(Number(v.value))}
                >
                  <NumberInput.Input />
                </NumberInput.Root>
              </Box>

              <Box>
                <Text mb={1}>Valid until</Text>
                <Input
                  type="datetime-local"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </Box>
            </VStack>
          )}
        </Dialog.Body>

        <Dialog.Footer>
          <HStack gap={2}>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              colorPalette="green"
              onClick={() => {
                onApproved(approvedKg, new Date(validUntil).toISOString());
                onClose();
              }}
            >
              Approve
            </Button>
          </HStack>
        </Dialog.Footer>

        <Dialog.CloseTrigger />
      </Dialog.Content>
    </Dialog.Root>
  );
}
