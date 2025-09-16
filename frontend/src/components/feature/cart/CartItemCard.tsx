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
import { releaseHoldById } from "@/api/cart";
import type { CartItem } from "@/types/cart";

interface Props {
  item: CartItem;
}

export const CartItemCard: React.FC<Props> = ({ item }) => {
  const { updateQty, remove } = useCart();
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeLeftMs = useMemo(
    () => item.holdExpiresAt - now,
    [item.holdExpiresAt, now]
  );
  const expired = timeLeftMs <= 0;

  useEffect(() => {
    if (!expired) return;
    (async () => {
      if (item.holdId) {
        try {
          await releaseHoldById(item.holdId);
        } catch {
          /* ignore */
        }
      }
      remove(item.id);
    })();
  }, [expired]);

  const chipScheme = expired ? "red" : timeLeftMs < 30_000 ? "orange" : "green";

  return (
    <Box borderWidth="1px" borderRadius="2xl" p={4}>
      <Flex gap={4} align="center">
        <Image
          src={item.imageUrl}
          alt={item.name}
          boxSize={{ base: "72px", md: "96px" }}
          objectFit="cover"
          borderRadius="xl"
        />
        <VStack align="start" gap={1} flex={1}>
          <HStack gap={2}>
            <Text fontWeight={700}>{item.name}</Text>
            {item.farmerName && <Badge variant="subtle">by {item.farmerName}</Badge>}
          </HStack>
          <Text color="gray.500">₪ {item.pricePerKg.toFixed(2)} / kg</Text>

          <HStack gap={2}>
            <IconButton
              aria-label="decrease"
              size="sm"
              onClick={() => updateQty(item.id, item.qtyKg - 1)}
            >
              <Minus size={16} />
            </IconButton>
            <Text minWidth="3ch" textAlign="center">
              {item.qtyKg}kg
            </Text>
            <IconButton
              aria-label="increase"
              size="sm"
              onClick={() => updateQty(item.id, item.qtyKg + 1)}
            >
              <Plus size={16} />
            </IconButton>
          </HStack>
        </VStack>
        <Spacer />
        <VStack align="end" gap={2}>
          <Badge colorScheme={chipScheme}>Hold: {toMMSS(timeLeftMs)}</Badge>
          <IconButton
            aria-label="remove"
            variant="outline"
            onClick={async () => {
              if (item.holdId) {
                try {
                  await releaseHoldById(item.holdId);
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
