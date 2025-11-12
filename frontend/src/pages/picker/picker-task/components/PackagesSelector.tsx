import { VStack, HStack, Heading, Button, Separator } from "@chakra-ui/react"
import SizeStrip, { type SizeCode } from "./SizeStrip"

type Props = {
  title?: string
  sizes: Record<"L" | "M" | "S" | "U", number>
  unfinishedBoxNos: Set<number>
  onPickSize: (sz: SizeCode) => void
  onPickBox: ((boxNo: number) => void) | null
  showBoxes?: boolean
}

export default function PackagesSelector({
  title,
  sizes,
  unfinishedBoxNos,
  onPickSize,
  onPickBox,
  showBoxes = true,
}: Props) {
  return (
    <VStack align="stretch" gap={4}>
      {title && <Heading size="lg">{title}</Heading>}
      <SizeStrip sizes={sizes} clickable onPickSize={onPickSize} />
      {showBoxes && (
        <>
          <Separator />
          <HStack wrap="wrap" gap={2}>
            {Array.from(unfinishedBoxNos)
              .sort((a, b) => a - b)
              .map((no) => (
                <Button
                  key={no}
                  size="2xl"
                  variant="surface"
                  onClick={() => {
                    if (onPickBox) onPickBox(no)
                  }}
                >
                  Box #{no}
                </Button>
              ))}
          </HStack>
        </>
      )}
    </VStack>
  )
}
