// src/pages/FarmerCropManagement/components/MapPreviewWIP.tsx
import { Badge, Box, HStack, Text } from "@chakra-ui/react";
import { useMemo } from "react";

export type MapPreviewWIPProps = {
  /** Number of rows in the mini matrix */
  rows?: number;
  /** Number of columns in the mini matrix */
  cols?: number;
  /** Visual height of the grid area */
  height?: string | number;
  /** Title text above the matrix */
  title?: string;
};

export default function MapPreviewWIP({
  rows = 6,
  cols = 10,
  height = "240px",
  title = "Map (WIP)",
}: MapPreviewWIPProps) {
  const cells = useMemo(() => Array.from({ length: rows * cols }, (_, i) => i), [rows, cols]);

  return (
    <Box
      borderWidth="1px"
      rounded="l3"
      p="4"
      bg="gray.50"
      _dark={{ bg: "gray.800", borderColor: "gray.700" }}
    >
      <HStack justify="space-between" mb="3">
        <Text fontWeight="semibold">{title}</Text>
        <Badge colorPalette="yellow">WIP</Badge>
      </HStack>

      <Box
        role="img"
        aria-label="section matrix preview"
        height={height}
        overflow="hidden"
      >
        <Box
          display="grid"
          gridTemplateColumns={`repeat(${cols}, 1fr)`}
          gap="1"
          height="full"
        >
          {cells.map((i) => (
            <Box
              key={i}
              rounded="sm"
              bg={i % 7 === 0 ? "green.300" : "gray.200"}
              _dark={{ bg: i % 7 === 0 ? "green.700" : "gray.700" }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
