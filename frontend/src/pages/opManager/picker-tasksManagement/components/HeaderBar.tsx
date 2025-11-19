import * as React from "react";
import { VStack, HStack, Heading, Text } from "@chakra-ui/react";
import {
  PickerStatCardsRow,
  type PickerStat,
} from "./StatusStats";

export default function HeaderBar({
  title,
  subtitle,
  stats,
}: {
  title: string;
  subtitle: string;
  stats: PickerStat[];
}) {
  return (
    <VStack align="stretch" spacing={3} w="full">
      <HStack justify="space-between" align="baseline">
        <Heading size="md">{title}</Heading>
        <Text fontSize="sm" color="fg.muted">
          {subtitle}
        </Text>
      </HStack>

      <PickerStatCardsRow stats={stats} />
    </VStack>
  );
}
