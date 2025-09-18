import {
  Dialog, DialogBody, DialogCloseTrigger, DialogFooter, DialogHeader, DialogTitle,
  VStack, Text, Badge, Textarea, HStack, Button,Box
} from "@chakra-ui/react";
import type { Shipment } from "@/types/farmer";
import { fmt, minutesUntil, twoHoursBefore } from "@/helpers/datetime";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  shipment: Shipment | null;
  onStart: () => void;
};

export default function StartPreparingDialog({ isOpen, onClose, shipment, onStart }: Props) {
  if (!shipment) return null;
  const harvestStartISO = twoHoursBefore(shipment.pickupTimeISO);
  const minutes = minutesUntil(harvestStartISO);
  const canStart = Date.now() >= new Date(harvestStartISO).getTime();

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <Dialog.Content>
        <DialogHeader>
          <DialogTitle>Shipment #{shipment.shipmentNumber}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <VStack align="stretch" gap={3}>
            <Text><b>Item:</b> {shipment.itemName}</Text>
            <Text><b>Amount:</b> {shipment.amountKg.toLocaleString()} kg ({shipment.containerCount} containers)</Text>
            <Text><b>Pickup time:</b> {fmt(shipment.pickupTimeISO)}</Text>
            <Text><b>Location:</b> {shipment.location}</Text>
            <Box />
            <Text fontWeight="bold">Harvesting window</Text>
            <Text>Earliest start: {fmt(harvestStartISO)} (2 hours before pickup)</Text>
            {canStart ? (
              <Badge colorPalette="green">You can start now</Badge>
            ) : (
              <Badge colorPalette="yellow">Starts in {minutes} min</Badge>
            )}
            <Box />
            <Text fontWeight="bold">Prepare container report</Text>
            <Text>Click <b>Start Preparing</b> to enter per-container data & print QR labels.</Text>
            <Textarea placeholder="Optional notes for the logistics center" />
          </VStack>
        </DialogBody>
        <DialogFooter>
          <HStack gap={2}>
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button colorPalette="blue" onClick={onStart} disabled={!canStart}>Start Preparing</Button>
          </HStack>
        </DialogFooter>
        <DialogCloseTrigger />
      </Dialog.Content>
    </Dialog.Root>
  );
}
