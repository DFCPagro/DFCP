// src/pages/orders/components/OrderTimeline.tsx
"use client";

import { HStack, VStack, Box, Text } from "@chakra-ui/react";
import {
  STATUS_LABEL,
  STATUS_EMOJI,
  normalizeStatus,
  type UIStatus,
} from "./helpers";

type Props = {
  stageKey: string;
  size?: "sm" | "md";
};

const FLOW: UIStatus[] = [
  "pending",
  "confirmed",
  "farmer",
  "intransit",
  "packing",
  "ready_for_pickup",
  "out_for_delivery",
  "delivered",
];

function mapStatus(s: string): UIStatus {
  const ui = normalizeStatus(s);
  return ui === "received" ? "delivered" : ui;
}

export default function OrderTimeline({ stageKey, size = "md" }: Props) {
  const ui = mapStatus(stageKey);
  const cancelled = ui === "cancelled";
  const steps: UIStatus[] = cancelled ? ([...FLOW.slice(0, -1), "cancelled"] as UIStatus[]) : FLOW;
  const currentIndex = steps.findIndex((x) => x === ui);

  const circle = size === "sm" ? "6" : "8";
  const activeCircle = size === "sm" ? "8" : "10";
  const connectorWidth = size === "sm" ? 36 : 48;

  return (
    <HStack align="center" gap={3} overflowX="auto">
      {steps.map((s, i) => {
        const isCancel = s === "cancelled";
        const active = i === currentIndex;
        const done = currentIndex >= 0 && i < currentIndex && !isCancel && !cancelled;

        const borderColor = isCancel ? "red.600" : active ? "teal.600" : done ? "teal.600" : "gray.400";
        const fg = isCancel ? "red.600" : active ? "teal.700" : done ? "teal.700" : "gray.500";
        const bg = isCancel ? "red.100" : active ? "teal.200" : done ? "teal.50" : "transparent";

        return (
          <HStack key={s} flex="0 0 auto" minW="max-content" gap={3}>
            <VStack gap={1}>
              <Box
                boxSize={active ? activeCircle : circle}
                borderRadius="full"
                borderWidth="2px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                color={fg}
                borderColor={borderColor}
                bg={bg}
                boxShadow={active ? "0 0 0 3px rgba(59,130,246,0.35)" : "none"} // blue ring
                _dark={{
                  bg: active ? "blue.400" : done ? "teal.900" : isCancel ? "red.900" : "transparent",
                  color: active ? "black" : undefined,
                  borderColor: active ? "blue.400" : borderColor,
                }}
                fontSize={size === "sm" ? "xs" : "sm"}
              >
                <span aria-hidden>{STATUS_EMOJI[s as UIStatus] ?? "•"}</span>
              </Box>
              <Text
                fontSize="xs"
                color={active ? "blue.700" : "gray.600"}
                fontWeight={active ? "bold" : "normal"}
                textTransform="capitalize"
              >
                {STATUS_LABEL[s as UIStatus] ?? s}
              </Text>
            </VStack>

            {i < steps.length - 1 && (
              <Box
                flex="0 0 auto"
                w={`${connectorWidth}px`}
                h="2px"
                bg={
                  cancelled
                    ? "gray.300"
                    : i < currentIndex
                    ? "teal.500"           // done
                    : i === currentIndex
                    ? "blue.500"           // active → next
                    : "gray.300"
                }
                _dark={{
                  bg: cancelled
                    ? "gray.600"
                    : i < currentIndex
                    ? "teal.600"
                    : i === currentIndex
                    ? "blue.400"
                    : "gray.600",
                }}
              />
            )}
          </HStack>
        );
      })}
    </HStack>
  );
}
