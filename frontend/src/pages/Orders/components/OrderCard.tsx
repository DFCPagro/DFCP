// pages/orders/components/OrderCard.tsx
import {
  Box,
  Grid,
  GridItem,
  HStack,
  IconButton,
  Text,
  Button,
} from "@chakra-ui/react";
import { MapPin } from "lucide-react";
import ItemList from "@/components/common/ItemList";
import type { OrderRowAPI } from "@/types/orders";
import {
  STATUS_EMOJI,
  STATUS_LABEL,
  formatDeliveryTime,
  normalizeStatus,
  pickCurrency,
  pickDeliveryPoint,
  toItemRows,
  isOldStatus,
  type LatLng,
} from "./helpers";

type Props = {
  order?: OrderRowAPI | null; // defensive
  isOpen: boolean;
  onToggleOpen: () => void;
  onOpenMap: (pt: LatLng, onlyDelivery: boolean) => void;
  onOpenNote: () => void;
};

export default function OrderCard({
  order,
  isOpen,
  onToggleOpen,
  onOpenMap,
  onOpenNote,
}: Props) {
  if (!order) return null; // guard against undefined items

  const ui = normalizeStatus((order as any).status);
  const emoji = STATUS_EMOJI[ui];
  const statusLabel = STATUS_LABEL[ui];
  const showNote = ui === "delivered" || ui === "received";
  const deliveryTime = formatDeliveryTime(order);
  const rows = toItemRows((order as any).items ?? []);
  const currency = pickCurrency((order as any).items ?? []) ?? "$";

  return (
    <Box borderWidth="1px" borderRadius="md" p={4}>
      <Grid
        templateColumns={{ base: "1fr", md: "1fr auto 1fr" }}
        gap={3}
        alignItems="center"
      >
        <GridItem minW={0}>
          <HStack gap={2}>
            <Text fontWeight="bold">Delivery time:</Text>
            <Text
              as="span"
              maxW="100%"
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {deliveryTime}
            </Text>
          </HStack>
        </GridItem>

        <GridItem justifySelf="center" zIndex={10}>
          <HStack gap={3}>
            <HStack gap={2}>
              <Text fontWeight="bold">Status:</Text>
              <Text>{statusLabel}</Text>
              <Text as="span" fontSize="xl">
                {emoji}
              </Text>
            </HStack>

            <IconButton
              aria-label="Open map"
              size="sm"
              variant="solid"
              onClick={(e) => {
                e.stopPropagation();
                const pt = pickDeliveryPoint(order);
                onOpenMap(pt, isOldStatus((order as any).status));
              }}
            >
              <MapPin size={16} />
            </IconButton>
          </HStack>
        </GridItem>

        <GridItem justifySelf="end">
          <HStack gap={2}>
            {showNote && <Button onClick={onOpenNote}>Delivery Note</Button>}
            <Button variant="outline" onClick={onToggleOpen}>
              {isOpen ? "Close" : "Full order"}
            </Button>
          </HStack>
        </GridItem>
      </Grid>

      {isOpen && (
        <Box mt={3} borderWidth="1px" borderRadius="md" p={3}>
          {rows.length ? (
            <ItemList items={rows} currency={currency} />
          ) : (
            <Text color="gray.600">No items attached.</Text>
          )}
        </Box>
      )}
    </Box>
  );
}
