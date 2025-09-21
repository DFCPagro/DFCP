// src/pages/FarmerCropManagement/components/EmptyState.tsx
import { Box, Stack, Heading, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

/**
 * Generic empty state block used across the FarmerCropManagement page.
 * - Chakra v3 friendly (uses `gap` instead of `spacing`, no deprecated props)
 * - Centered by default, but can align left
 * - Optional icon/illustration and action area
 */
export type EmptyStateProps = {
  title: string;
  subtitle?: string;
  /** Optional top illustration or icon */
  visual?: ReactNode;
  /** Optional actions (e.g., a Button) */
  action?: ReactNode;
  /** "center" (default) or "left" */
  align?: "center" | "left";
  /** Optional min height (useful to create breathing room) */
  minH?: string | number;
  /** Optional border toggle */
  showOutline?: boolean;
  /** Optional custom content under the action area */
  children?: ReactNode;
};

export default function EmptyState({
  title,
  subtitle,
  visual,
  action,
  align = "center",
  minH = "160px",
  showOutline = false,
  children,
}: EmptyStateProps) {
  const isCenter = align === "center";

  return (
    <Box
      role="status"
      borderWidth={showOutline ? "1px" : "0"}
      borderStyle="dashed"
      borderColor="gray.300"
      rounded="2xl"
      px="6"
      py="10"
      minH={minH}
      bg="gray.50"
      _dark={{ bg: "gray.800", borderColor: "gray.700" }}
    >
      <Stack
        alignItems={isCenter ? "center" : "flex-start"}
        textAlign={isCenter ? "center" : "left"}
        gap="3"
      >
        {visual ? <Box>{visual}</Box> : null}

        <Heading size="lg">{title}</Heading>

        {subtitle ? (
          <Text color="gray.600" _dark={{ color: "gray.300" }}>
            {subtitle}
          </Text>
        ) : null}

        {action ? <Box pt="2">{action}</Box> : null}

        {children ? <Box pt="2" w="full">{children}</Box> : null}
      </Stack>
    </Box>
  );
}
