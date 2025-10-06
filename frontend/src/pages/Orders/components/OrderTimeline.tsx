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
  status: string;
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

export default function OrderTimeline({ status, size = "md" }: Props) {
  const ui = mapStatus(status);
  const cancelled = ui === "cancelled";
  const steps: UIStatus[] = cancelled ? ([...FLOW.slice(0, -1), "cancelled"] as UIStatus[]) : FLOW;
  const currentIndex = steps.findIndex((x) => x === ui);

  const circle = size === "sm" ? "6" : "8"; // chakra size tokens
  const connectorWidth = size === "sm" ? 36 : 48;

  return (
    <HStack align="center" gap={3} overflowX="auto">
      {steps.map((s, i) => {
        const isCancel = s === "cancelled";
        const active = i === currentIndex;
        const done = currentIndex >= 0 && i <= currentIndex && !isCancel && !cancelled;
        const color = isCancel
          ? "red.500"
          : done
          ? "teal.500"
          : active
          ? "blue.500"
          : "gray.400";

        return (
          <HStack key={s} flex="0 0 auto" minW="max-content" gap={3}>
            <VStack gap={1}>
              <Box
                boxSize={circle}
                borderRadius="full"
                borderWidth="2px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                color={color}
                borderColor={color}
                bg={
                  isCancel
                    ? "red.50"
                    : done
                    ? "teal.50"
                    : active
                    ? "blue.50"
                    : "transparent"
                }
                _dark={{
                  bg: isCancel
                    ? "red.900"
                    : done
                    ? "teal.900"
                    : active
                    ? "blue.900"
                    : "transparent",
                }}
                fontSize={size === "sm" ? "xs" : "sm"}
              >
                <span aria-hidden>{STATUS_EMOJI[s as UIStatus] ?? "•"}</span>
              </Box>
              <Text fontSize="xs" color="gray.600" textTransform="capitalize">
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
                    ? "teal.400"
                    : "gray.300"
                }
                _dark={{
                  bg: cancelled ? "gray.600" : i < currentIndex ? "teal.600" : "gray.600",
                }}
              />
            )}
          </HStack>
        );
      })}
    </HStack>
  );
}
