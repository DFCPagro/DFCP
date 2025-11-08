import * as React from "react";
import {
  Box,
  HStack,
  Stack,
  Text,
  Button,
  Badge,
  Separator,
  Image,
  Spinner,
} from "@chakra-ui/react";
import type { FarmerOrderDTO } from "@/types/farmerOrders";
import RejectNoteDialog from "./RejectNoteDialog";
import { formatDMY, formatTimeHM, formatShiftLabel } from "@/utils/date";
import { getItemsCatalog, type ItemCatalogEntry } from "@/api/items";

export type IncomingOrderCardProps = {
  order: FarmerOrderDTO;
  onAccept: (id: string) => void;
  onReject: (id: string, note: string) => void;
  accepting?: boolean;
  rejecting?: boolean;
};

export default function IncomingOrderCard({
  order,
  onAccept,
  onReject,
  accepting,
  rejecting,
}: IncomingOrderCardProps) {
  const [openReject, setOpenReject] = React.useState(false);
  const [imageUrl, setImageUrl] = React.useState<string | null>(order.pictureUrl || null);
  const [loadingImage, setLoadingImage] = React.useState(false);

  // Fetch image via catalog if missing on the order
  React.useEffect(() => {
    let cancelled = false;

    async function resolveImage() {
      if (order.pictureUrl) {
        setImageUrl(order.pictureUrl);
        return;
      }

      if (!order.type) {
        setImageUrl("https://cdn-icons-png.flaticon.com/512/415/415733.png");
        return;
      }

      try {
        setLoadingImage(true);
        const catalog = await getItemsCatalog();

        const norm = (s: string) => s.trim().toLowerCase();

        // Prefer match on both type + variety; fallback to type-only.
        let match: ItemCatalogEntry | undefined = catalog.find(
          (c) =>
            norm(c.type) === norm(order.type!) &&
            (order.variety ? norm(c.variety ?? "") === norm(order.variety) : true) &&
            !!c.imageUrl
        );

        if (!match) {
          match = catalog.find(
            (c) => norm(c.type) === norm(order.type!) && !!c.imageUrl
          );
        }

        if (!cancelled) {
          setImageUrl(
            match?.imageUrl || "https://cdn-icons-png.flaticon.com/512/415/415733.png"
          );
        }
      } catch {
        if (!cancelled) {
          setImageUrl("https://cdn-icons-png.flaticon.com/512/415/415733.png");
        }
      } finally {
        if (!cancelled) setLoadingImage(false);
      }
    }

    resolveImage();
    return () => {
      cancelled = true;
    };
  }, [order.pictureUrl, order.type, order.variety]);

  // Time label: prefer actual pickUpTime, fallback to 10:00
  const pickupTimeLabel = order.pickUpTime ? formatTimeHM(order.pickUpTime) : "10:00";
  const pickupLabel = `${formatDMY(order.pickUpDate)} · ${formatShiftLabel(
    order.shift
  )} · ${pickupTimeLabel}`;

  // Forecasted quantity only
  const qtyLabel = `${order.forcastedQuantityKg ?? 0} kg`;

  return (
    <Box
      borderWidth="1px"
      borderColor="border"
      borderRadius="xl"
      bg="bg"
      p="4"
      minW="280px"
      _hover={{ shadow: "md" }}
      transition="box-shadow 0.15s ease"
    >
      <HStack alignItems="flex-start" gap="4">
        {/* Image */}
        <Box flexShrink={0} position="relative" minW="72px" minH="72px">
          {loadingImage ? (
            <Spinner size="sm" />
          ) : (
            <Image
              src={imageUrl || "https://cdn-icons-png.flaticon.com/512/415/415733.png"}
              alt={order.type || "Item image"}
              boxSize="72px"
              objectFit="cover"
              borderRadius="md"
              borderWidth="1px"
              borderColor="gray.200"
            />
          )}
        </Box>

        {/* Content */}
        <Stack flex="1" gap="3">
          <HStack justifyContent="space-between" alignItems="center">
            <Text fontWeight="semibold">{pickupLabel}</Text>
            <Badge colorPalette="orange">Incoming</Badge>
          </HStack>

          <Separator />

          <Stack gap="1">
            <Text>
              <b>Item:</b> {order.type}
              {order.variety ? `, ${order.variety}` : ""}
            </Text>
            <Text>
              <b>Forecasted Qty:</b> {qtyLabel}
            </Text>
          </Stack>

          <HStack justifyContent="flex-end" gap="2" pt="2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOpenReject(true)}
              loading={!!rejecting}
              disabled={!!accepting || !!rejecting}
            >
              Reject
            </Button>
            <Button
              size="sm"
              colorPalette="green"
              onClick={() => onAccept(order.id!)}
              loading={!!accepting}
              disabled={!!accepting || !!rejecting}
            >
              Accept
            </Button>
          </HStack>
        </Stack>
      </HStack>

      {/* Reject dialog */}
      <RejectNoteDialog
        isOpen={openReject}
        onClose={() => setOpenReject(false)}
        onSubmit={(note) => onReject(order.id!, note)}
        orderLabel={`${order.type}${order.variety ? ` ${order.variety}` : ""} — ${pickupLabel}`}
      />
    </Box>
  );
}
