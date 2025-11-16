import { useEffect } from "react"
import {
  Badge,
  Button,
  Card,
  Grid,
  HStack,
  Image,
  Input,
  Text,
  VStack,
  Box,
} from "@chakra-ui/react"
import { type PlanPiece } from "@/api/pickerTask"

/* Deterministic pseudo-random location from item id */
function getLocation(itemId?: string) {
  const id = String(itemId || "0")
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const zones = ["A", "B", "C", "D"]
  const zone = zones[h % zones.length]
  const shelf = (h % 20) + 1
  const bin = (Math.floor(h / 7) % 8) + 1
  return { zone, shelf, bin }
}

export type CurrentItemPanelProps = {
  cur: PlanPiece | undefined
  curName: string
  curImg: string
  selectedBoxNo: number
  SizeStrip: string
  arrivalConfirmed: boolean
  /** Always present and validated as kilograms */
  isKg: boolean
  isKgValid: boolean
  /** Unused when always in KG, kept for API compatibility */
  isUnitsValid: boolean
  weightInput: string
  /** Unused when always in KG, kept for API compatibility */
  unitsInput: string
  setWeightInput: (v: string) => void
  /** Unused when always in KG, kept for API compatibility */
  setUnitsInput: (v: string) => void
  onConfirmArrival: () => void
  onContinue: () => void
}

export default function CurrentItemPanel({
  cur,
  curName,
  curImg,
  selectedBoxNo,
  SizeStrip,
  arrivalConfirmed,
  isKg, // ignored; always KG mode
  isKgValid,
  isUnitsValid, // eslint-disable-line @typescript-eslint/no-unused-vars
  weightInput,
  unitsInput, // eslint-disable-line @typescript-eslint/no-unused-vars
  setWeightInput,
  setUnitsInput, // eslint-disable-line @typescript-eslint/no-unused-vars
  onConfirmArrival,
  onContinue,
}: CurrentItemPanelProps) {
  if (!cur) {
    return (
      <Card.Root borderWidth="1px" borderRadius="2xl">
        <Card.Body>
          <VStack align="start" gap={4}>
            <Text fontSize="lg">All pieces done for this box.</Text>
          </VStack>
        </Card.Body>
      </Card.Root>
    )
  }

  // Pre-fill the input with the backend estimate once arrival is confirmed
  useEffect(() => {
    if (arrivalConfirmed && (weightInput == null || weightInput === "")) {
      const est = Math.round((cur.estWeightKgPiece ?? 0) * 100) / 100
      if (est > 0) setWeightInput(String(est))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrivalConfirmed, cur.estWeightKgPiece])

  const loc = getLocation(cur.itemId)

  return (
        <Card.Root borderWidth="1px" borderRadius="2xl">
  <Card.Header>
    <HStack justify="space-between" w="full">
      <HStack gap={3}>
        <Text as="h2" fontSize="lg" fontWeight="semibold">
          {curName}
        </Text>
        <Badge size="lg" variant="outline">{`Box #${selectedBoxNo} size #${SizeStrip}`}</Badge>
      </HStack>
    </HStack>
  </Card.Header>

  <Card.Body>
    <Grid
      templateColumns={{ base: "1fr", md: "auto 1fr" }}
      gap={6}
      alignItems="start"
    >
      {/* LEFT COLUMN: image (left) + location (right) */}
      <HStack align="flex-start" gap={4} w="full">
        <Image
          src={curImg}
          alt={curName}
          borderRadius="lg"
          maxH="250px"
          objectFit="contain"
        />

        <VStack align="flex-start" gap={3} minW="160px">
          <Text
            fontSize="sm"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="wide"
            color="fg.muted"
          >
            Location
          </Text>

          <Badge
            variant="solid"
            colorPalette="teal"
            px={4}
            py={2}
            borderRadius="full"
            fontSize="lg"
          >
            Zone {loc.zone}
          </Badge>

          <Badge
            variant="solid"
            colorPalette="teal"
            px={4}
            py={2}
            borderRadius="full"
            fontSize="lg"
          >
            Shelf {loc.shelf}
          </Badge>

          <Badge
            variant="solid"
            colorPalette="teal"
            px={4}
            py={2}
            borderRadius="full"
            fontSize="lg"
          >
            Bin {loc.bin}
          </Badge>
        </VStack>
      </HStack>

      {/* RIGHT COLUMN: details, input, buttons */}
      <VStack align="stretch" gap={5}>
        <HStack gap={6} flexWrap="wrap">
          <Badge size="lg" variant="surface" colorPalette="purple">
            Piece: {cur.pieceType}
          </Badge>
          <Badge size="lg" variant="surface" colorPalette="teal">
            Mode: {cur.mode}
          </Badge>
          {cur.qtyKg != null && (
            <Badge size="lg" variant="surface" colorPalette="purple">
              Required kg: {cur.qtyKg}
            </Badge>
          )}
        </HStack>

        {arrivalConfirmed && (
          <VStack align="stretch" gap={2}>
            <Text fontSize="md" fontWeight="semibold">
              Units: {Math.round((cur.units ?? 0) * 100) / 100}
            </Text>
            <Text fontWeight="semibold">Enter measured weight</Text>

            <HStack gap={3} maxW="sm">
              <Input
                inputMode="decimal"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                aria-label="Actual weight in kilograms"
              />
              <Text>kg</Text>
            </HStack>
            <Text color="fg.muted" fontSize="sm">
              KG: {Math.round((cur.estWeightKgPiece ?? 0) * 10) / 10} Units:{" "}
              {Math.round((cur.units ?? 0) * 100) / 100}
            </Text>
          </VStack>
        )}

        <HStack gap={3} minH="100px">
          {!arrivalConfirmed && (
            <Button
              alignSelf="flex-start"
              size="lg"
              variant="solid"
              colorPalette="blue"
              onClick={onConfirmArrival}
              borderRadius="full"
            >
              Confirm arrival
            </Button>
          )}
          {arrivalConfirmed && (
            <Button
              size="lg"
              colorPalette="teal"
              onClick={onContinue}
              disabled={!isKgValid}
              borderRadius="full"
            >
              Confirm & Continue
            </Button>
          )}
        </HStack>
      </VStack>
    </Grid>
  </Card.Body>
</Card.Root>

  )
}
