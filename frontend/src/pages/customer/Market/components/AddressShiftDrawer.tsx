import { useCallback, useEffect, useMemo, useState, useRef } from "react"
import {
  Box,
  Button,
  Dialog,
  Drawer,
  HStack,
  Icon,
  IconButton,
  Portal,
  RadioGroup,
  Separator,
  Skeleton,
  Stack,
  Text,
  VisuallyHidden,
  useDisclosure,
} from "@chakra-ui/react"
import { FiMapPin, FiRefreshCw, FiPlus, FiCheck, FiTrash2 } from "react-icons/fi"
import { toaster } from "@/components/ui/toaster"
import MapPickerDialog from "@/components/common/SingleLocationPicker"
import {
  addCustomerAddress,
  getAvailableShiftsByLC,
  getCustomerAddresses,
} from "@/api/market"
import type { Address } from "@/types/address"
import type { AvailableShiftFlat } from "@/types/market"

/* ---------------------------------- Types --------------------------------- */

export type AddressShiftDrawerProps = {
  /** Open/close state controlled by parent */
  isOpen: boolean
  onClose: () => void

  /** When true, we render "view" mode (show current + [Change]).
      When false, we render "picker" mode (choose Address + Shift). */
  active: boolean

  /** Current, validated selection (active mode only) */
  currentAddress: Address | null
  currentShift: AvailableShiftFlat | null

  /** Called after user confirms "Change" (parent clears cart + selection + sets inactive) */
  onConfirmChange: () => Promise<void> | void

  /** Called when user picks a new address+shift (in picker mode). Parent should call setSelection() */
  onPick: (payload: { address: Address; shift: AvailableShiftFlat }) => Promise<void> | void
}

/* ------------------------------- Component -------------------------------- */

export default function AddressShiftDrawer({
  isOpen,
  onClose,
  active,
  currentAddress,
  currentShift,
  onConfirmChange,
  onPick,
}: AddressShiftDrawerProps) {
  // Local state for picker mode
  const [addresses, setAddresses] = useState<Address[]>([])
  const [addrLoading, setAddrLoading] = useState(false)
  const [addrError, setAddrError] = useState<string | null>(null)

  const [selectedAddressIdx, setSelectedAddressIdx] = useState<string>("") // RadioGroup expects string
  const selectedAddress: Address | null = useMemo(() => {
    const idx = Number.isFinite(+selectedAddressIdx) ? parseInt(selectedAddressIdx, 10) : -1
    return idx >= 0 && idx < addresses.length ? addresses[idx] : null
  }, [selectedAddressIdx, addresses])

  const [shifts, setShifts] = useState<AvailableShiftFlat[]>([])
  const [shiftsLoading, setShiftsLoading] = useState(false)
  const [shiftsError, setShiftsError] = useState<string | null>(null)
  const [selectedMarketStockId, setSelectedMarketStockId] = useState<string>("")

  const selectedShift: AvailableShiftFlat | null = useMemo(() => {
    if (!selectedMarketStockId) return null
    return shifts.find((s) => s.marketStockId === selectedMarketStockId) ?? null
  }, [selectedMarketStockId, shifts])


  // Confirm dialog for [Change]
  const {
    open: isConfirmOpen,
    onOpen: openConfirm,
    onClose: closeConfirm,
  } = useDisclosure()
  const [confirmWorking, setConfirmWorking] = useState(false)

  // Map picker dialog (add new address)
  const {
    open: mapOpen,
    onOpen: openMap,
    onClose: closeMap,
  } = useDisclosure()

  /* ----------------------------- Data loaders ------------------------------ */

  const loadAddresses = useCallback(async () => {
    try {
      setAddrError(null)
      setAddrLoading(true)
      const list = await getCustomerAddresses()
      setAddresses(list ?? [])
      if ((list?.length ?? 0) === 0) {
        setSelectedAddressIdx("")
      } else {
        setSelectedAddressIdx((prev) => (prev === "" ? "0" : prev));
      }

    } catch (e: any) {
      setAddrError(e?.message ?? "Failed to load addresses")
      setAddresses([])
    } finally {
      setAddrLoading(false)
    }
  }, [])

  const loadShiftsForAddress = useCallback(
    async (addr: Address | null) => {
      if (!addr?.logisticCenterId) {
        setShifts([])
        setSelectedMarketStockId("")
        return
      }
      try {
        setShiftsError(null)
        setShiftsLoading(true)
        // inside loadShiftsForAddress()
        const raw = await getAvailableShiftsByLC(addr.logisticCenterId);

        // Optional: temporary debug so you can see what arrived & what we keep
        console.log("[Shifts] raw:", raw);

        const mapped: AvailableShiftFlat[] = (raw ?? []).flatMap((row: any) => {
          const key = String(row.shift ?? row.key ?? row.shiftKey ?? "").toLowerCase();
          const date = String(row.date ?? row.availableDate ?? row.day ?? "").slice(0, 10);
          // prefer real id; otherwise synthesize a stable one so UI can select
          const realId =
            String(row.docId ?? row.marketStockId ?? row._id ?? row.id ?? "") || undefined;
          const syntheticId = `synthetic:${addr.logisticCenterId}:${date}:${key}`;
          const id = realId ?? syntheticId;

          if (!key || !date) return []; // only drop truly invalid rows (missing shift/date)

          return [{
            shift: key as AvailableShiftFlat["shift"],
            date,
            marketStockId: id,
            // fix precedence bug (see patch #2)
            slotLabel: (row.deliverySlotLabel ?? row.slotLabel)
              ? String(row.deliverySlotLabel ?? row.slotLabel)
              : undefined,
          }];
        });


        setShifts(mapped);

        // reset previous selection if it’s no longer present
        if (!mapped.some((s) => s.marketStockId === selectedMarketStockId)) {
          setSelectedMarketStockId("");
        }


      } catch (e: any) {
        setShiftsError(e?.message ?? "Failed to load shifts")
        setShifts([])
        setSelectedMarketStockId("")
      } finally {
        setShiftsLoading(false)
      }
    },
    [selectedMarketStockId],
  )

  /* ----------------------------- Effects & init ---------------------------- */

  // When drawer opens in picker mode, load address list once
  const didInitThisOpenRef = useRef(false); // <-- import/useRef at top

  useEffect(() => {
    if (!isOpen) { didInitThisOpenRef.current = false; return; }
    if (active) return;
    if (didInitThisOpenRef.current) return;
    didInitThisOpenRef.current = true;
    loadAddresses();
  }, [isOpen, active, loadAddresses]);


  // When drawer opens in picker mode, load addresses (and shifts for first addr)
  useEffect(() => {
    if (!isOpen || active) return
    const idx = Number.isFinite(+selectedAddressIdx) ? parseInt(selectedAddressIdx, 10) : -1
    const addr = idx >= 0 && idx < addresses.length ? addresses[idx] : null
    loadShiftsForAddress(addr)
  }, [isOpen, active, selectedAddressIdx, addresses, loadShiftsForAddress])

  // Reset local picker state when closing
  useEffect(() => {
    if (isOpen) return
    setSelectedAddressIdx("")
    setSelectedMarketStockId("")
    setShifts([])
    setAddresses([])
    setAddrError(null)
    setShiftsError(null)
  }, [isOpen])

  /* -------------------------------- Actions -------------------------------- */

  // Confirm "Change"
  const handleConfirmChange = useCallback(async () => {
    setConfirmWorking(true)
    try {
      await Promise.resolve(onConfirmChange())
      toaster.create({
        title: "Selection cleared",
        description: "Your cart was emptied and the market was reset.",
        type: "success",
      })
      closeConfirm()
      onClose()
    } catch (e: any) {
      toaster.create({
        title: "Could not change selection",
        description: e?.message ?? "Please try again",
        type: "error",
      })
    } finally {
      setConfirmWorking(false)
    }
  }, [onConfirmChange, onClose, closeConfirm])

  // Save picked address+shift
  const handleSavePick = useCallback(async () => {
    if (!selectedAddress || !selectedShift) return
    try {
      await Promise.resolve(onPick({ address: selectedAddress, shift: selectedShift }))
      toaster.create({
        title: "Market updated",
        description: "Address & shift selected successfully.",
        type: "success",
      })
      onClose()
    } catch (e: any) {
      toaster.create({
        title: "Could not select",
        description: e?.message ?? "Please try again",
        type: "error",
      })
    }
  }, [onPick, onClose, selectedAddress, selectedShift])

  // Add new address via MapPickerDialog
  const handleMapPicked = useCallback(
    async (addr: Address | null) => {
      if (!addr) return
      try {
        await addCustomerAddress(addr)
        toaster.create({
          title: "Address added",
          description: addr.address,
          type: "success",
        })
        await loadAddresses()
      } catch (e: any) {
        toaster.create({
          title: "Could not add address",
          description: e?.message ?? "Please try again",
          type: "error",
        })
      } finally {
        closeMap()
      }
    },
    [loadAddresses, closeMap],
  )

  /* --------------------------------- Render -------------------------------- */

  const canSave = !!selectedAddress && !!selectedShift && !shiftsLoading && !addrLoading

  return (
    <>
      <Drawer.Root
        open={isOpen}
        onOpenChange={(e) => {
          if (!e.open) onClose()
        }}
        placement="end"
        size="md"
      >
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              <Drawer.Header>
                <HStack justify="space-between" width="full">
                  <HStack>
                    <Icon as={FiMapPin} />
                    <Text>{active ? "Current address & shift" : "Pick address & shift"}</Text>
                  </HStack>
                  {!active && (
                    <IconButton aria-label="Reload" size="sm" variant="ghost" onClick={loadAddresses}>
                      <FiRefreshCw />
                    </IconButton>
                  )}
                </HStack>
              </Drawer.Header>

              <Drawer.Body>
                {active ? (
                  <Stack gap="6">
                    <Box>
                      <Text fontWeight="semibold" mb="1">
                        Address
                      </Text>
                      <Text color="fg.muted">{currentAddress?.address ?? "—"}</Text>
                    </Box>
                    <Box>
                      <Text fontWeight="semibold" mb="1">
                        Shift
                      </Text>
                      <Text color="fg.muted">{formatShift(currentShift) ?? "—"}</Text>
                    </Box>
                    <Separator />
                    <Text color="fg.muted">
                      Changing your selection will empty your cart and refresh market stock.
                    </Text>
                  </Stack>
                ) : (
                  <Stack gap="8">
                    {/* Addresses */}
                    <Stack gap="3">
                      <HStack justify="space-between">
                        <Text fontWeight="semibold">Choose address</Text>
                        <Button size="sm" onClick={openMap}>
                          <Icon as={FiPlus} style={{ marginInlineEnd: "0.5rem" }} />
                          Add new
                        </Button>
                      </HStack>

                      {addrLoading ? (
                        <Stack>
                          <Skeleton height="6" />
                          <Skeleton height="6" />
                          <Skeleton height="6" />
                        </Stack>
                      ) : addrError ? (
                        <Text color="red.500" fontSize="sm">
                          {addrError}
                        </Text>
                      ) : addresses.length === 0 ? (
                        <Text color="fg.muted">No addresses yet. Add one to continue.</Text>
                      ) : (
                        <RadioGroup.Root
                          value={selectedAddressIdx}
                          onValueChange={(e) => setSelectedAddressIdx(e.value ?? "")}
                        >
                          <Stack gap="2">
                            {addresses.map((a, idx) => (
                              <RadioCard
                                key={`${a.address}-${idx}`}
                                value={String(idx)}
                                title={a.address || "—"}
                              />
                            ))}
                          </Stack>
                        </RadioGroup.Root>
                      )}
                    </Stack>

                    {/* Shifts */}
                    <Stack gap="3">
                      <HStack justify="space-between">
                        <Text fontWeight="semibold">Choose shift</Text>
                        <VisuallyHidden>
                          <Text>For LC based on selected address</Text>
                        </VisuallyHidden>
                      </HStack>

                      {shiftsLoading ? (
                        <Stack>
                          <Skeleton height="6" />
                          <Skeleton height="6" />
                          <Skeleton height="6" />
                        </Stack>
                      ) : shiftsError ? (
                        <Text color="red.500" fontSize="sm">
                          {shiftsError}
                        </Text>
                      ) : !selectedAddress ? (
                        <Text color="fg.muted">Pick an address to see shifts.</Text>
                      ) : shifts.length === 0 ? (
                        <Text color="fg.muted">No shifts available for this address.</Text>
                      ) : (
                        <RadioGroup.Root
                          value={selectedMarketStockId}
                          onValueChange={(e) => setSelectedMarketStockId(e.value ?? "")}
                        >
                          <Stack gap="2">
                            {shifts.map((s) => (
                              <RadioCard
                                key={s.marketStockId}
                                value={s.marketStockId}
                                title={formatShift(s)}
                              />
                            ))}
                          </Stack>
                        </RadioGroup.Root>
                      )}
                    </Stack>
                  </Stack>
                )}
              </Drawer.Body>

              <Drawer.Footer>
                {active ? (
                  <HStack width="full" justify="space-between">
                    <Button variant="ghost" onClick={onClose}>
                      Close
                    </Button>
                    <Button colorPalette="red" onClick={openConfirm}>
                      <Icon as={FiTrash2} style={{ marginInlineEnd: "0.5rem" }} />
                      Change
                    </Button>
                  </HStack>
                ) : (
                  <HStack width="full" justify="space-between">
                    <Button variant="ghost" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button onClick={handleSavePick} disabled={!canSave} colorPalette="teal">
                      <Icon as={FiCheck} style={{ marginInlineEnd: "0.5rem" }} />
                      Use this address & shift
                    </Button>
                  </HStack>
                )}
              </Drawer.Footer>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>

      {/* Confirm dialog for [Change] */}
      <Dialog.Root
        open={isConfirmOpen}
        onOpenChange={(e) => {
          if (confirmWorking) return
          if (e.open) openConfirm()
          else closeConfirm()
        }}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Change selection</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                The cart will be emptied and the market stock will change by doing this action. Are you
                sure?
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="ghost" onClick={closeConfirm} disabled={confirmWorking}>
                  Cancel
                </Button>
                <Button colorPalette="red" onClick={handleConfirmChange} loading={confirmWorking}>
                  Confirm
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* Map Picker for adding new address */}
<MapPickerDialog
  open={mapOpen}
  onClose={closeMap}
  onConfirm={handleMapPicked}
  countries="IL"
  pointMarkerLabel="A"
  pointMarkerTitle="New"
  initial={{
    lat: 32.726884,
    lng: 35.215722,
    address: "Zarzir, Israel",
  }}
/>

    </>
  )
}

/* --------------------------------- Bits ---------------------------------- */

function formatShift(s: AvailableShiftFlat | null | undefined): string | undefined {
  if (!s) return undefined;
  const date = s.date ?? "";
  const key = s.shift ? s.shift[0].toUpperCase() + s.shift.slice(1) : "";
  // If you want to append the slot label, uncomment:
  // const base = `${date}${date && key ? " • " : ""}${key}`;
  // return s.slotLabel ? `${base} (${s.slotLabel})` : base;
  return `${date}${date && key ? " • " : ""}${key} , delivery time : ${s.slotLabel ?? "No slot"}`;
}


function formatCoords(a: Address): string {
  const lat = (a as any).lat ?? (a as any).alt ?? NaN;
  const lng = (a as any).lng ?? (a as any).lnt ?? NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

function RadioCard(props: { value: string; title?: string; }) {
  const { value, title } = props
  return (
    <RadioGroup.Item
      value={value}
      alignItems="start"
      p="3"
      borderWidth="1px"
      borderRadius="lg"
      _checked={{ borderColor: "teal.500", bg: "teal.50" }}
      cursor="pointer"
    >
      <HStack align="start" gap="3">
        <RadioGroup.ItemIndicator mt="1" />
        <Stack gap="0">
          <Text fontWeight="medium">{title ?? "—"}</Text>

        </Stack>
      </HStack>
      <RadioGroup.ItemHiddenInput />
    </RadioGroup.Item>
  )
}
