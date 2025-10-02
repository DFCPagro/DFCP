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
// If you already have a shared confirm dialog component, feel free to swap:
// import ConfirmDialog from "./ConfirmDialog";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export type CartLine = {
  // identity fields (not all guaranteed, so we fall back carefully)
  stockId?: string;         // <itemId>_<farmerId> (canonical)
  id?: string;
  lineId?: string;
  itemId?: string;
  farmerId?: string;

  // display
  name?: string;
  displayName?: string;
  imageUrl?: string;
  farmerName?: string;
  farmName?: string;

  // pricing & qty (support both kg- and unit-based lines)
  pricePerUnit?: number;    // preferred key from your normalized API
  unitPrice?: number;       // legacy fallback
  price?: number;           // legacy fallback

  qtyKg?: number;           // preferred for kg-based
  qty?: number;             // fallback for unit-based

  // any other fields are ignored
  [key: string]: any;
};

export type CartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;

  items: CartLine[];

  /** remove a single line by a stable key */
  onRemove?: (key: string) => void;

  /** clear the cart */
  onClear?: () => void;

  /** proceed to checkout */
  onCheckout?: () => void;
};

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

/** Stable key so same product from different farmers NEVER merges */
function getLineKey(line: CartLine): string {
  // 1) Canonical: stockId = "<itemId>_<farmerId>"
  if (line.stockId && typeof line.stockId === "string") return line.stockId;

  // 2) Explicit ids
  if (line.id && typeof line.id === "string") return line.id;
  if (line.lineId && typeof line.lineId === "string") return line.lineId;

  // 3) Compose minimal identity (product + farmer)
  const item = line.itemId ?? "item";
  const farmer = line.farmerId ?? "farmer";
  return `${item}|${farmer}`;
}

function getUnitPrice(line: CartLine): number {
  const cand =
    line.pricePerUnit ??
    line.priceUsd ??
    line.price ??
    0;
  const n = Number(cand);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function getQty(line: CartLine): number {
  // prefer kg-based qty when available, else fallback to unit-based
  const cand = (line.qtyKg ?? line.qty ?? 0);
  const n = Number(cand);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function getName(line: CartLine): string {
  return (line.name ?? line.displayName ?? "Item");
}

function formatMoneyUSD(val: number): string {
  // keep formatting minimal; adapt to your currency if needed
  return `$${val.toFixed(2)}`;
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
      <Portal> {/* 👈 render outside the Drawer to escape its stacking/focus */}
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content
            // make sure it stacks above the Drawer
            // (Drawer is already high; 10000 is safe. Adjust if you have a token.)
            style={{ zIndex: 10000 }}
          >
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
  onCheckout,
}: CartDrawerProps) {
  const { ask, ConfirmDialogInline } = useConfirm();

  const subtotal = useMemo(
    () => items.reduce((sum, l) => sum + getUnitPrice(l) * getQty(l), 0),
    [items]
  );

  const totalQty = useMemo(
    () => items.reduce((sum, l) => sum + getQty(l), 0),
    [items]
  );

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
      {/* Inline confirm dialog (swap for your shared <ConfirmDialog> if you want) */}
      {ConfirmDialogInline}

      <Drawer.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="md" placement="start">
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content >
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
                      const key = getLineKey(line); // <<<<<< KEY uses stockId first
                      const qty = getQty(line);
                      const price = getUnitPrice(line);
                      const lineTotal = price * qty;
                      // console.log("Cart item:", line);
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
                                <Box
                                  boxSize="56px"
                                  rounded="md"
                                  bg="bg.subtle"
                                />
                              )}
                              <Stack gap="1">
                                <Text fontWeight="medium">{getName(line)}</Text>
                                {line.farmerName && (
                                  <Text fontSize="sm" color="fg.muted">
                                    {line.farmerName}
                                  </Text>
                                )}
                                <HStack gap="2">
                                  <Text fontSize="sm" color="fg.muted">
                                    Qty: {qty}
                                  </Text>
                                  <Separator orientation="vertical" />
                                  <Text fontSize="sm" color="fg.muted">
                                    Unit: {formatMoneyUSD(price)}
                                  </Text>
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
                    <Text color="fg.muted">Total qty</Text>
                    <Text>{totalQty}</Text>
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
