import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Flex,
  Image,
  Text,
  HStack,
  IconButton,
  Badge,
  VStack,
  Spacer,
} from "@chakra-ui/react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/store/cart";
import { toMMSS } from "@/utils/format";
//import { releaseHoldById } from "@/api/cart";
import type { CartItem } from "@/types/cart";

interface Props {
  item: CartItem;
}

export const CartItemCard: React.FC<Props> = ({ item }) => {
  const { updateQty, remove } = useCart();
  const [now, setNow] = useState<number>(Date.now());

  // ⬇ Safe coercions (support both Market + existing cart shapes)
  const unitPrice = useMemo(
    () => Number((item as any).pricePerKg ?? (item as any).price ?? (item as any).unitPrice ?? 0),
    [item]
  );
  const qty = useMemo(
    () => Number((item as any).qtyKg ?? (item as any).qty ?? 1),
    [item]
  );
  const farmerName = (item as any).farmerName ?? (item as any).farmer?.name ?? "";
  const displayImg = (item as any).imageUrl ?? "";

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeLeftMs = useMemo(() => (item.holdExpiresAt ?? 0) - now, [item.holdExpiresAt, now]);
  const expired = timeLeftMs <= 0;
  const chipScheme = expired ? "red" : timeLeftMs < 30_000 ? "orange" : "green";

  // Normalize update calls to your store (assume store expects the same unit we display)
  const setQty = (next: number) => {
    const clamped = Math.max(1, Math.floor(next || 1));
    // Try both expected arg names; your store likely uses one of these
    try {
      updateQty(item.id, clamped as any);
    } catch {
      // no-op fallback
    }
  };

  useEffect(() => {
    if (!expired) return;
    (async () => {
      if ((item as any).holdId) {
        try {
          //await releaseHoldById((item as any).holdId);
        } catch {
          /* ignore */
        }
      }
      remove(item.id);
    })();
  }, [expired, item, remove]);

  return (
    <Box borderWidth="1px" borderRadius="2xl" p={4}>
      <Flex gap={4} align="center">
        <Image
          src={displayImg || "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="}
          alt={item.name}
          boxSize={{ base: "72px", md: "96px" }}
          objectFit="cover"
          borderRadius="xl"
        />
        <VStack align="start" gap={1} flex={1}>
          <HStack gap={2}>
            <Text fontWeight={700}>{item.name}</Text>
            {farmerName && <Badge variant="subtle">by {farmerName}</Badge>}
          </HStack>

          {/* unit price (always a number now) */}
          <Text color="gray.500">₪ {unitPrice.toFixed(2)}</Text>

          {/* quantity controls */}
          <HStack gap={2}>
            <IconButton
              aria-label="decrease"
              size="sm"
              onClick={() => setQty(qty - 1)}
            >
              <Minus size={16} />
            </IconButton>
            <Text minWidth="3ch" textAlign="center">
              {qty}
            </Text>
            <IconButton
              aria-label="increase"
              size="sm"
              onClick={() => setQty(qty + 1)}
            >
              <Plus size={16} />
            </IconButton>
          </HStack>
        </VStack>

        <Spacer />

        <VStack align="end" gap={2}>
          <Badge colorScheme={chipScheme}>Hold: {toMMSS(Math.max(0, timeLeftMs))}</Badge>
          <IconButton
            aria-label="remove"
            variant="outline"
            onClick={async () => {
              if ((item as any).holdId) {
                try {
                  //await releaseHoldById((item as any).holdId);
                } catch {}
              }
              remove(item.id);
            }}
          >
            <Trash2 size={16} />
          </IconButton>
        </VStack>
      </Flex>
    </Box>
  );
};
