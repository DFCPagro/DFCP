import { Card, Grid, VStack, HStack, Badge, Text, Image, Button, Input } from "@chakra-ui/react"
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
  arrivalConfirmed: boolean
  isKg: boolean
  isKgValid: boolean
  isUnitsValid: boolean
  weightInput: string
  unitsInput: string
  setWeightInput: (v: string) => void
  setUnitsInput: (v: string) => void
  onConfirmArrival: () => void
  onContinue: () => void
}

export default function CurrentItemPanel({
  cur,
  curName,
  curImg,
  selectedBoxNo,
  arrivalConfirmed,
  isKg,
  isKgValid,
  isUnitsValid,
  weightInput,
  unitsInput,
  setWeightInput,
  setUnitsInput,
  onConfirmArrival,
  onContinue,
}: CurrentItemPanelProps) {
  if (!cur) {
    return (
      <Card.Root rounded="2xl" borderWidth="1px">
        <Card.Body>
          <VStack align="start" gap={4}>
            <Text fontSize="lg">All pieces done for this box.</Text>
          </VStack>
        </Card.Body>
      </Card.Root>
    )
  }

  const loc = getLocation(cur.itemId)

  return (
    <Card.Root rounded="2xl" borderWidth="1px">
      <Card.Header>
        <HStack justify="space-between" w="full">
          <HStack gap={3}>
            <Text as="h2" fontSize="lg" fontWeight="semibold">
              {curName}
            </Text>
            <Badge size="lg" variant="outline">{`Box #${selectedBoxNo}`}</Badge>
          </HStack>
          <HStack gap={3}>
            <Badge variant="surface">Zone {loc.zone}</Badge>
            <Badge variant="surface">Shelf {loc.shelf}</Badge>
            <Badge variant="surface">Bin {loc.bin}</Badge>
          </HStack>
        </HStack>
      </Card.Header>

      <Card.Body>
        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={6} alignItems="start">
          {/* Left: image */}
          <Image src={curImg} alt={curName} rounded="lg" maxH="360px" w="100%" objectFit="cover" />

          {/* Right: details, input, buttons */}
          <VStack align="stretch" gap={5}>
            <HStack gap={6} wrap="wrap">
              <Badge size="lg" variant="surface" colorPalette="purple">
                Piece: {cur.pieceType}
              </Badge>
              <Badge size="lg" variant="surface" colorPalette="teal">
                Mode: {cur.mode}
              </Badge>
              {cur.units != null && cur.mode !== "kg" && (
                <Badge size="lg" variant="surface" colorPalette="purple">
                  Required units: {cur.units}
                </Badge>
              )}
            </HStack>

            {/* Inputs appear only AFTER arrival is confirmed */}
            {arrivalConfirmed && (
              <>
                {isKg ? (
                  <VStack align="stretch" gap={2}>
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
                      Est kg/pc: {Math.round(cur.estWeightKgPiece * 100) / 100} • Liters: {Math.round(cur.liters * 10) / 10}
                    </Text>
                  </VStack>
                ) : (
                  <VStack align="stretch" gap={2}>
                    <Text fontWeight="semibold">Enter picked units</Text>
                    <HStack gap={3} maxW="sm">
                      <Input
                        inputMode="numeric"
                        type="number"
                        step="1"
                        min="1"
                        placeholder="0"
                        value={unitsInput}
                        onChange={(e) => setUnitsInput(e.target.value)}
                        aria-label="Picked units"
                      />
                      <Text>units</Text>
                    </HStack>
                    <Text color="fg.muted" fontSize="sm">
                      Target units: {cur.units ?? 1}
                    </Text>
                  </VStack>
                )}
              </>
            )}

            {/* Right column buttons centered and mutually exclusive */}
            <HStack gap={3} justify="center" align="center" minH="100px">
              {!arrivalConfirmed && (
                <Button size="lg" variant="solid" colorPalette="blue" onClick={onConfirmArrival} rounded="full">
                  Confirm arrival
                </Button>
              )}
              {arrivalConfirmed && (
                <Button
                  size="lg"
                  colorPalette="teal"
                  onClick={onContinue}
                  disabled={!(isKg ? isKgValid : isUnitsValid)}
                  rounded="full"
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
