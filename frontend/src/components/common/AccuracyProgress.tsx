import { Box, Progress } from "@chakra-ui/react"

type AccuracyProgressProps = {
    value: number // 0-100
    thresholds?: { warn: number; ok: number } // defaults: warn=50, ok=80
    palettes?: { low: string; mid: string; high: string } // chakra color palettes
    Max?: number // defaults to 100
}

function getPalette(
    value: number,
    thresholds: { warn: number; ok: number },
    palettes: { low: string; mid: string; high: string },
) {
    if (value < thresholds.warn) return palettes.low
    if (value < thresholds.ok) return palettes.mid
    return palettes.high
}

export default function AccuracyProgress({
    value,
    thresholds = { warn: 50, ok: 80 },
    palettes = { low: "red", mid: "yellow", high: "green" },
    Max = 100,
}: AccuracyProgressProps) {
    const palette = getPalette(value, thresholds, palettes)

    return (
        <Box w="full">
            <Progress.Root
                value={value}
                max={Max}
                h="2"
                borderRadius="md"
                striped
                animated
                colorPalette={palette}
            >
                <Progress.Track bg="gray.100" _dark={{ bg: "gray.700" }}>
                    <Progress.Range bgGradient="linear(to-r, blue.500, cyan.500, green.500)" />
                </Progress.Track>
            </Progress.Root>
        </Box>
    )
}
