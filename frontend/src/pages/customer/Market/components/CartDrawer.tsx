// src/pages/.../components/CartDrawer.tsx
import { memo, useCallback, useMemo, useState } from "react";
import {
  Box,
  Button,
  HStack,
  IconButton,
  Image,
  Separator,
  Stack,
  Text,
  Drawer,
  Dialog,
  Portal,
} from "@chakra-ui/react";
import { FiTrash2, FiX } from "react-icons/fi";
import { toaster } from "@/components/ui/toaster";
import type { CartLine } from "@/utils/marketCart.shared"; // ✅ shared, canonical line type

/* -------------------------------------------------------------------------- */
/*                                   Props                                    */
/* -------------------------------------------------------------------------- */

export type CartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  items: CartLine[];

  /** remove a single line by a stable key */
  onRemove?: (key: string) => void;

  /** clear the cart */
  onClear?: () => void;

  /** change quantity (UNITS) for a line identified by its stable key */
  onChangeQty?: (key: string, nextUnits: number) => void;

  /** proceed to checkout */
  onCheckout?: () => void;
};

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

/** Stable key so same product from different farmers NEVER merges */
function getLineKey(line: CartLine): string {
  // Prefer canonical `key` if provided by the store; then stockId; else compose
  if (line.key && typeof line.key === "string") return line.key;
  if (line.stockId && typeof line.stockId === "string") return line.stockId;

  // 3) Compose minimal identity (product + farmer)
  const item = (line as any).itemId ?? "item";
  const farmer = (line as any).farmerId ?? "farmer";
  return `${item}|${farmer}`;
}

function getUnitPrice(line: CartLine): number {
  const cand = (line as any).pricePerUnit ?? 0;
  const n = Number(cand);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function getUnits(line: CartLine): number {
  const n = Number(line.quantity);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function getName(line: CartLine): string {
  return (line.name ?? (line as any).displayName ?? "Item");
}

function formatMoneyUSD(val: number): string {
  return `$${(Number(val) || 0).toFixed(2)}`;
}

function getAvgUnitKg(line: CartLine): number {
  const cand = (line as any).avgWeightPerUnitKg;
  const n = Number(cand);
  return Number.isFinite(n) && n > 0 ? n : 0.02; // ✅ fallback per your spec
}

/* -------------------------------------------------------------------------- */
/*                              Inline Confirm (UX)                            */
/* -------------------------------------------------------------------------- */

function useConfirm() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<null | {
    title: string;
    body?: string;
    onConfirm: () => void;
  }>(null);

  const ask = useCallback((title: string, onConfirm: () => void, body?: string) => {
    setPending({ title, onConfirm, body });
    setOpen(true);
  }, []);

  const ConfirmDialogInline = (
    <Dialog.Root open={open} onOpenChange={(e) => !e.open && setOpen(false)}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content style={{ zIndex: 120 }}>
            <Dialog.Header>
              <Dialog.Title>{pending?.title ?? "Confirm"}</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <IconButton aria-label="Close" variant="ghost" size="sm">
                  <FiX />
                </IconButton>
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <Text>{pending?.body ?? "Are you sure?"}</Text>
            </Dialog.Body>
            <Dialog.Footer>
              <HStack>
                <Button
                  onClick={() => {
                    setOpen(false);
                  }}
                  variant="subtle"
                >
                  Cancel
                </Button>
                <Button
                  colorPalette="red"
                  onClick={() => {
                    const fn = pending?.onConfirm;
                    setOpen(false);
                    if (fn) fn();
                  }}
                >
                  Confirm
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );

  return { ask, ConfirmDialogInline };
}

/* -------------------------------------------------------------------------- */
/*                                 Component                                  */
/* -------------------------------------------------------------------------- */

function CartDrawerBase({
  isOpen,
  onClose,
  items,
  onRemove,
  onClear,
  onChangeQty,
  onCheckout,
}: CartDrawerProps) {
  const { ask, ConfirmDialogInline } = useConfirm();

  // Money subtotal
  const subtotal = useMemo(
    () => items.reduce((sum, l) => sum + getUnitPrice(l) * getUnits(l), 0),
    [items]
  );

  // Units / Weight totals
  const { totalUnits, totalApproxKg } = useMemo(() => {
    let units = 0;
    let kg = 0;
    for (const l of items) {
      const u = getUnits(l);
      units += u;
      kg += u * getAvgUnitKg(l);
    }
    return { totalUnits: units, totalApproxKg: kg };
  }, [items]);

  const handleRemove = useCallback(
    (line: CartLine) => {
      const key = getLineKey(line);
      ask(
        "Remove this item?",
        () => {
          onRemove?.(key);
          toaster.create({
            title: "Removed from cart",
            description: getName(line),
            type: "success",
            duration: 2500,
          });
        },
        getName(line)
      );
    },
    [ask, onRemove]
  );

  const handleClear = useCallback(() => {
    ask("Clear cart?", () => {
      onClear?.();
      toaster.create({
        title: "Cart cleared",
        type: "success",
        duration: 2500,
      });
    }, "This will remove all items from your cart.");
  }, [ask, onClear]);

  const handleCheckout = useCallback(() => {
    onCheckout?.();
    toaster.create({
      title: "Proceeding to checkout",
      type: "info",
      duration: 2200,
    });
  }, [onCheckout]);

  return (
    <>
      {/* Inline confirm dialog */}
      {ConfirmDialogInline}

      <Drawer.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="md" placement="start">
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header>
              <HStack justify="space-between" width="full">
                <Text fontWeight="semibold">Your Cart</Text>
                <IconButton aria-label="Close cart" variant="ghost" onClick={onClose}>
                  <FiX />
                </IconButton>
              </HStack>
            </Drawer.Header>

            <Drawer.Body>
              <Stack gap="4">
                {/* Items list */}
                <Stack gap="3">
                  {items.length === 0 ? (
                    <Box px="2" py="8" textAlign="center" color="fg.muted">
                      <Text>Your cart is empty.</Text>
                    </Box>
                  ) : (
                    items.map((line) => {
                      const key = getLineKey(line);
                      const units = getUnits(line);
                      const price = getUnitPrice(line);
                      const lineTotal = price * units;
                      const perUnitKg = getAvgUnitKg(line);
                      const approxKg = units * perUnitKg;

                      const canDec = units > 1;         // 1..50
                      const canInc = units < 50;

                      return (
                        <Box key={key} p="3" borderWidth="1px" rounded="lg">
                          <HStack align="flex-start" justify="space-between">
                            <HStack align="flex-start" gap="3">
                              {line.imageUrl ? (
                                <Image
                                  src={line.imageUrl}
                                  alt={getName(line)}
                                  boxSize="56px"
                                  objectFit="cover"
                                  rounded="md"
                                />
                              ) : (
                                <Box boxSize="56px" rounded="md" bg="bg.subtle" />
                              )}
                              <Stack gap="1">
                                <Text fontWeight="medium">{getName(line)}</Text>
                                {line.farmerName && (
                                  <Text fontSize="sm" color="fg.muted">
                                    {line.farmerName}
                                  </Text>
                                )}

                                <HStack gap="3" align="center" wrap="wrap">
                                  {/* Quantity controls (UNITS) */}
                                  <HStack gap="2" align="center">
                                    <Text fontSize="sm" color="fg.muted">Units:</Text>
                                    <IconButton
                                      aria-label="Decrease units"
                                      size="xs"
                                      variant="outline"
                                      disabled={!canDec}
                                      onClick={() => {
                                        const next = units - 1;
                                        if (next <= 0) {
                                          onRemove?.(key);
                                          toaster.create({
                                            title: "Removed from cart",
                                            description: getName(line),
                                            type: "success",
                                            duration: 2500,
                                          });
                                        } else {
                                          onChangeQty?.(key, next);
                                        }
                                      }}
                                    >
                                      –
                                    </IconButton>
                                    <Text fontSize="sm" color="fg.muted">{units}</Text>
                                    <IconButton
                                      aria-label="Increase units"
                                      size="xs"
                                      variant="outline"
                                      disabled={!canInc}
                                      onClick={() => {
                                        const next = units + 1;
                                        onChangeQty?.(key, next);
                                      }}
                                    >
                                      +
                                    </IconButton>
                                  </HStack>

                                  {/* On the side: ≈ weight */}
                                  <Separator orientation="vertical" />
                                  <Text fontSize="sm" color="fg.muted">≈ {approxKg.toFixed(2)} kg</Text>

                                  <Separator orientation="vertical" />

                                  {/* Price per unit */}
                                  <Text fontSize="sm" color="fg.muted">Price/unit: {formatMoneyUSD(price)}</Text>
                                </HStack>
                              </Stack>
                            </HStack>

                            <Stack align="flex-end" gap="2" minW="120px">
                              <Text fontWeight="semibold">
                                {formatMoneyUSD(lineTotal)}
                              </Text>
                              <IconButton
                                aria-label="Remove item"
                                variant="outline"
                                size="sm"
                                colorPalette="red"
                                onClick={() => handleRemove(line)}
                              >
                                <FiTrash2 />
                              </IconButton>
                            </Stack>
                          </HStack>
                        </Box>
                      );
                    })
                  )}
                </Stack>

                <Separator />

                {/* Totals */}
                <Stack gap="1">
                  <HStack justify="space-between">
                    <Text color="fg.muted">Total units</Text>
                    <Text>{totalUnits}</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="fg.muted">Total approx weight</Text>
                    <Text>{totalApproxKg.toFixed(2)} kg</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text fontWeight="medium">Subtotal</Text>
                    <Text fontWeight="semibold">{formatMoneyUSD(subtotal)}</Text>
                  </HStack>
                </Stack>
              </Stack>
            </Drawer.Body>

            <Drawer.Footer>
              <HStack width="full" justify="space-between">
                <Button
                  variant="outline"
                  colorPalette="red"
                  onClick={handleClear}
                  disabled={items.length === 0}
                >
                  Clear
                </Button>
                <Button
                  onClick={handleCheckout}
                  disabled={items.length === 0}
                >
                  Checkout
                </Button>
              </HStack>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    </>
  );
}

export const CartDrawer = memo(CartDrawerBase);
export default CartDrawer;
