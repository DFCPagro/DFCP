import { useCallback, useMemo, useRef, useState } from "react"
import {
  Alert,
  AspectRatio,
  Box,
  Button,
  Dialog,
  Separator,
  Drawer,
  HStack,
  IconButton,
  Image,
  Portal,
  Skeleton,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react"
import { FiTrash2, FiCheck } from "react-icons/fi"
import { toaster } from "@/components/ui/toaster"

/** Minimal duck-typed cart line (we avoid adding shared types on purpose) */
type CartLine = Record<string, any>

export type CartDrawerProps = {
  isOpen: boolean
  onClose: () => void

  /** Current cart lines */
  items: CartLine[]

  /** Called to remove a single line */
  onRemove: (line: CartLine) => Promise<void> | void

  /** Called to clear entire cart (after confirm) */
  onClear: () => Promise<void> | void

  /** Called to proceed to checkout */
  onCheckout: () => Promise<void> | void

  /** Loading flags (optional) */
  loading?: boolean // initial load
  workingIds?: string[] // show spinner on specific line removes
  checkingOut?: boolean
  clearing?: boolean
  error?: string | null
}

/* ------------------------------ helpers ------------------------------ */
function lineId(line: CartLine): string {
  return (
    line.id ??
    line.lineId ??
    `${line.itemId ?? line.name ?? "item"}|${line.farmerId ?? line.farmerName ?? "farmer"}`
  )
}
function getName(line: CartLine): string {
  return String(line.name ?? line.itemName ?? "Item")
}
function getFarmer(line: CartLine): string | undefined {
  return (line.farmerName ?? line.farmer ?? undefined) as string | undefined
}
function getImage(line: CartLine): string | undefined {
  return line.imageUrl ?? line.img ?? line.photo ?? line.picture ?? undefined
}
function getQtyKg(line: CartLine): number {
  const cand = line.qtyKg ?? line.quantityKg ?? line.kg ?? line.quantity ?? line.qty ?? 0
  const n = Number(cand)
  return Number.isFinite(n) ? n : 0
}
function getUnitPriceUSD(line: CartLine): number {
  const cand = line.priceUsd ?? line.usd ?? line.price ?? line.unitPrice ?? line.pricePerUnit ?? 0
  const n = Number(cand)
  return Number.isFinite(n) ? n : 0
}
function formatMoneyUSD(v: number): string {
  const n = Number.isFinite(v) ? v : 0
  return `$${n.toFixed(2)}`
}

/* -------------------------------- UI --------------------------------- */
export default function CartDrawer({
  isOpen,
  onClose,
  items,
  onRemove,
  onClear,
  onCheckout,
  loading = false,
  workingIds = [],
  checkingOut = false,
  clearing = false,
  error = null,
}: CartDrawerProps) {
  const [localWorking, setLocalWorking] = useState<string | null>(null)

  // Confirm dialog for Clear Cart (v3: use Dialog with role="alertdialog")
  const {
    open: isConfirmOpen,
    onOpen: openConfirm,
    onClose: closeConfirm,
  } = useDisclosure()
  const [confirmBusy, setConfirmBusy] = useState(false)
  const cancelRef = useRef<HTMLButtonElement | null>(null)

  const subtotal = useMemo(() => {
    return items.reduce((sum, line) => sum + getUnitPriceUSD(line) * getQtyKg(line), 0)
  }, [items])

  const totalQtyKg = useMemo(() => {
    return items.reduce((sum, line) => sum + getQtyKg(line), 0)
  }, [items])

  const handleRemove = useCallback(
    async (line: CartLine) => {
      const id = lineId(line)
      setLocalWorking(id)
      try {
        await Promise.resolve(onRemove(line))
        toaster.create({
          title: "Removed",
          description: getName(line),
          type: "success",
        })
      } catch (e: any) {
        toaster.create({
          title: "Could not remove item",
          description: e?.message ?? "Please try again",
          type: "error",
        })
      } finally {
        setLocalWorking(null)
      }
    },
    [onRemove],
  )

  const handleClear = useCallback(async () => {
    setConfirmBusy(true)
    try {
      await Promise.resolve(onClear())
      toaster.create({
        title: "Cart cleared",
        type: "success",
      })
      closeConfirm()
    } catch (e: any) {
      toaster.create({
        title: "Could not clear cart",
        description: e?.message ?? "Please try again",
        type: "error",
      })
    } finally {
      setConfirmBusy(false)
    }
  }, [onClear, closeConfirm])

  const handleCheckout = useCallback(async () => {
    try {
      await Promise.resolve(onCheckout())
    } catch (e: any) {
      toaster.create({
        title: "Checkout failed",
        description: e?.message ?? "Please try again",
        type: "error",
      })
    }
  }, [onCheckout])

  const isLineWorking = (line: CartLine) =>
    localWorking === lineId(line) || workingIds.includes(lineId(line))

  const empty = !loading && items.length === 0

  return (
    <>
      {/* Drawer v3 compound API */}
      <Drawer.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="lg" placement="end">
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              <Drawer.Header>
                <Drawer.Title>Cart</Drawer.Title>
              </Drawer.Header>

              <Drawer.Body>
                {/* Error (v3 Alert slots) */}
                {error ? (
                  <Alert.Root status="error" rounded="md" mb="3">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Text fontSize="sm">{error}</Text>
                    </Alert.Content>
                  </Alert.Root>
                ) : null}

                {/* Lines */}
                <Stack gap="4">
                  {loading ? (
                    <>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <HStack key={`s-${i}`} gap="3" align="stretch">
                          <AspectRatio ratio={1} w="88px">
                            <Skeleton />
                          </AspectRatio>
                          <Stack flex="1" gap="2">
                            <Skeleton h="16px" />
                            <Skeleton h="12px" />
                            <Skeleton h="12px" />
                          </Stack>
                          <Skeleton h="10" w="10" rounded="md" />
                        </HStack>
                      ))}
                    </>
                  ) : empty ? (
                    <Box py="10" textAlign="center" color="fg.muted">
                      <Text>Your cart is empty.</Text>
                    </Box>
                  ) : (
                    items.map((line) => {
                      const id = lineId(line)
                      const img = getImage(line)
                      const name = getName(line)
                      const farmer = getFarmer(line)
                      const qtyKg = getQtyKg(line)
                      const unitPrice = getUnitPriceUSD(line)
                      const total = unitPrice * qtyKg

                      return (
                        <Box key={id}>
                          <HStack gap="3" align="stretch">
                            {/* Image */}
                            <AspectRatio ratio={1} w="88px">
                              <Box bg="bg.muted">
                                {img ? (
                                  <Image src={img} alt={name} objectFit="cover" />
                                ) : (
                                  <Box />
                                )}
                              </Box>
                            </AspectRatio>

                            {/* Texts */}
                            <Stack flex="1" gap="1" minW="0">
                              <Text fontWeight="semibold" lineClamp={1}>
                                {name}
                              </Text>
                              {farmer ? (
                                <Text fontSize="sm" color="fg.muted" lineClamp={1}>
                                  {farmer}
                                </Text>
                              ) : null}

                              {/* Qty (kg) • Total ($) */}
                              <Text fontSize="sm">
                                <Text as="span" color="fg.muted">
                                  {qtyKg} kg
                                </Text>
                                <Text as="span" mx="2" color="fg.muted">
                                  •
                                </Text>
                                <Text as="span" fontWeight="medium">
                                  {formatMoneyUSD(total)}
                                </Text>
                              </Text>
                            </Stack>

                            {/* Remove (v3 IconButton: children + loading/disabled props) */}
                            <IconButton
                              aria-label="Remove"
                              variant="outline"
                              colorPalette="red"
                              onClick={() => handleRemove(line)}
                              loading={isLineWorking(line)}
                              title="Remove from cart"
                            >
                              <FiTrash2 />
                            </IconButton>
                          </HStack>

                          <Separator my="3" />
                        </Box>
                      )
                    })
                  )}
                </Stack>
              </Drawer.Body>

              {/* Summary + actions */}
              <Drawer.Footer>
                <Stack w="full" gap="3">
                  <HStack justify="space-between">
                    <Text color="fg.muted">Total weight</Text>
                    <Text fontWeight="medium">{totalQtyKg.toFixed(2)} kg</Text>
                  </HStack>
                  <HStack justify="space-between">
                    <Text color="fg.muted">Subtotal</Text>
                    <Text fontWeight="semibold">{formatMoneyUSD(subtotal)}</Text>
                  </HStack>

                  <HStack mt="1" justify="space-between">
                    <Button variant="outline" colorPalette="red" onClick={openConfirm} disabled={empty}>
                      <FiTrash2 /> Clear cart
                    </Button>
                    <HStack gap="3">
                      <Button variant="ghost" onClick={onClose}>
                        Close
                      </Button>
                      <Button
                        colorPalette="teal"
                        onClick={handleCheckout}
                        disabled={empty}
                        loading={checkingOut}
                      >
                        <FiCheck /> Checkout
                      </Button>
                    </HStack>
                  </HStack>
                </Stack>
              </Drawer.Footer>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>

      {/* Confirm dialog for Clear Cart (v3 uses Dialog) */}
      <Dialog.Root
        role="alertdialog"
        open={isConfirmOpen}
        onOpenChange={(e) => {
          // prevent closing while busy
          if (!e.open && !confirmBusy) closeConfirm()
        }}
        initialFocusEl={() => cancelRef.current}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Clear cart</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                This will remove all items from your cart. Are you sure?
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button ref={cancelRef} variant="ghost" disabled={confirmBusy}>
                    Cancel
                  </Button>
                </Dialog.ActionTrigger>
                <Button colorPalette="red" onClick={handleClear} loading={confirmBusy || clearing}>
                  Confirm
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  )
}
