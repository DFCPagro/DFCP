import { HStack, Image, VStack, Text, Badge } from "@chakra-ui/react"
import type { PlanPiece } from "@/api/pickerTask"

export type CatalogItem = {
  _id?: string
  type?: string
  variety?: string
  category?: string
  imageUrl?: string
  name?: string
}

type Props = {
  piece: PlanPiece
  index: number
  isDone: boolean
  getMeta: (itemId?: string) => CatalogItem | undefined
}

export default function PieceRow({ piece, index, isDone, getMeta }: Props) {
  const meta = getMeta(String(piece.itemId))
  const displayName =
    piece.itemName || meta?.name || `${meta?.type ?? ""} ${meta?.variety ?? ""}`.trim() || String(piece.itemId)
  const img = meta?.imageUrl || "/img/item-placeholder.png"

  return (
    <HStack key={`${piece.itemId}-${index}`} gap={4} align="center" py={2}>
      <Image src={img} alt={displayName} rounded="md" w="64px" h="64px" objectFit="cover" />
      <VStack align="start" gap={0} flex="1">
        <Text fontSize="md" fontWeight="semibold">
          {displayName}
        </Text>
        <HStack gap={3} wrap="wrap">
          <Badge size="sm" variant="surface">
            {piece.pieceType}
          </Badge>
          <Badge size="sm" variant="surface" colorPalette={piece.mode === "kg" ? "teal" : "purple"}>
            {piece.mode === "kg" ? "Kg" : `Units${piece.units ? `: ${piece.units}` : ""}`}
          </Badge>
          <Text color="fg.muted" fontSize="sm">
            est kg/pc {Math.round(piece.estWeightKgPiece * 100) / 100} • {Math.round(piece.liters * 10) / 10}L
          </Text>
        </HStack>
      </VStack>
      <Badge variant={isDone ? "solid" : "outline"} colorPalette={isDone ? "green" : "gray"}>
        {isDone ? "Done" : "Pending"}
      </Badge>
    </HStack>
  )
}
