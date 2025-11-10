import { Box, Grid, VStack, Text } from "@chakra-ui/react"
import { Package as PackageIcon } from "lucide-react"

export type SizeCode = "L" | "M" | "S" | "U"

function PkgGlyph() {
  return (
    <Box
      w="36px"
      h="36px"
      rounded="md"
      borderWidth="1px"
      bg="bg.subtle"
      _dark={{ bg: "blackAlpha.300" }}
      display="grid"
      placeItems="center"
    >
      <PackageIcon size={18} />
    </Box>
  )
}

export default function SizeStrip({
  sizes,
  clickable = false,
  onPickSize,
  borderAccent = true,
}: {
  sizes: Partial<Record<SizeCode, number>>
  clickable?: boolean
  onPickSize?: (sizeCode: SizeCode) => void
  borderAccent?: boolean
}) {
  const order: SizeCode[] = ["L", "M", "S", "U"]
  const label: Record<SizeCode, string> = { L: "Large", M: "Medium", S: "Small", U: "Box" }

  const visible = order.filter((sz) => (sizes[sz] ?? 0) > 0)
  if (visible.length === 0) return null

  return (
    <Box
      rounded="xl"
      borderWidth="2px"
      borderColor={borderAccent ? "blackAlpha.600" : "blackAlpha.300"}
      _dark={{ borderColor: borderAccent ? "whiteAlpha.700" : "whiteAlpha.400" }}
      overflow="hidden"
    >
      <Grid templateColumns={`repeat(${visible.length}, 1fr)`} gap="5px">
        {visible.map((sz, idx) => {
          const count = sizes[sz] ?? 0
          return (
            <Box
              key={sz}
              p={{ base: 4, md: 6 }}
              position="relative"
              cursor={clickable ? "pointer" : "default"}
              onClick={clickable && onPickSize ? () => onPickSize(sz) : undefined}
              _hover={clickable ? { bg: "bg.subtle", _dark: { bg: "blackAlpha.300" } } : undefined}
            >
              {idx < visible.length - 1 && (
                <Box
                  position="absolute"
                  top="0"
                  right="0"
                  bottom="0"
                  borderRightWidth="2px"
                  borderColor="blackAlpha.600"
                  _dark={{ borderColor: "whiteAlpha.400" }}
                />
              )}
              <VStack gap={2}>
                <PkgGlyph />
                <Text fontSize="xl" fontWeight="bold">
                  {label[sz]}
                </Text>
                <Text fontSize="lg" fontWeight="semibold">
                  x{count}
                </Text>
              </VStack>
            </Box>
          )
        })}
      </Grid>
    </Box>
  )
}
