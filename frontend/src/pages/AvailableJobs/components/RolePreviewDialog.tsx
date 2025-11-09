"use client";

import StyledIconButton from "@/components/ui/IconButton";
import {
  Badge,
  Box,
  Button,
  Dialog,
  HStack,
  Icon,
  Portal,
  Separator,
  Stack,
  Text,
  VisuallyHidden,
} from "@chakra-ui/react";
import { Sparkles, X } from "lucide-react";

export type RoleDetails = {
  name: string;
  description: string;
  coverSrc?: string;
  category?: string;
  location?: string;
  shift?: string;
  currency?: string;
  payMin?: number;
  payMax?: number;
  highlights?: string[];
  requirements?: string[];
  responsibilities?: string[];
  faq?: Array<{ q: string; a: string }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: RoleDetails | null;
  onConfirm: () => void;
  /**
   * Optional navigation function from your app/router.
   * If not provided, window.location.href is used.
   */
  navigate?: (path: string) => void;
  /**
   * Destination path or builder. Defaults to `/employment/application?role=<name>`.
   */
  applicationHref?: string | ((details: RoleDetails) => string);
};

/**
 * A dynamic, rich dialog that renders role-specific details.
 * Pass a RoleDetails object for each role (from JSON / API).
 */
export function RolePreviewDialog({
  open,
  onOpenChange,
  details,
  onConfirm,
  navigate,
  applicationHref,
}: Props) {
  if (!details) return null;

  const payText =
    details.payMin != null && details.payMax != null
      ? `${details.currency ?? "$"}${details.payMin}–${details.payMax} / hr`
      : "Pay scale varies by shift & location";

  const targetHref =
    typeof applicationHref === "function"
      ? applicationHref(details)
      : applicationHref ??
        `/employment/application?role=${encodeURIComponent(details.name ?? "")}`;

  const goToApplication = () => {
    onConfirm?.();
    onOpenChange?.(false);

    if (typeof navigate === "function") {
      navigate(targetHref);
    } else {
      window.location.href = targetHref; // hard navigation fallback
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content
            maxW="2xl"
            borderRadius="2xl"
            overflow="hidden"
            shadow="lg"
            borderWidth="1px"
          >
            {/* Header */}
            <Box p={{ base: 4, md: 5 }}>
              <HStack justify="space-between" align="start">
                <HStack>
                  <Icon as={Sparkles} />
                  <Dialog.Title fontSize="xl" fontWeight="semibold">
                    {details.name}
                  </Dialog.Title>
                </HStack>
                <Dialog.CloseTrigger asChild>
                  <StyledIconButton size="sm" variant="subtle" borderRadius="lg">
                    <X />
                  </StyledIconButton>
                </Dialog.CloseTrigger>
              </HStack>

              {/* Chips */}
              <HStack mt="3" wrap="wrap" gap="2">
                {details.category && (
                  <Badge variant="subtle" colorPalette="green" borderRadius="full">
                    {details.category}
                  </Badge>
                )}
                {details.location && (
                  <Badge variant="outline" colorPalette="gray" borderRadius="full">
                    {details.location}
                  </Badge>
                )}
                {details.shift && (
                  <Badge variant="outline" colorPalette="gray" borderRadius="full">
                    {details.shift}
                  </Badge>
                )}
                <Badge variant="solid" colorPalette="purple" borderRadius="full">
                  {payText}
                </Badge>
                <VisuallyHidden>Role chips</VisuallyHidden>
              </HStack>
            </Box>

            <Separator />

            {/* Scrollable body */}
            <Box
              maxH="60vh"
              overflowY="auto"
              px={{ base: 4, md: 5 }}
              py={{ base: 4, md: 5 }}
            >
              <Stack gap="5">
                {/* Overview */}
                <Box>
                  <Text fontWeight="semibold" mb="1">
                    Overview
                  </Text>
                  <Text color="fg.muted">{details.description}</Text>
                </Box>

                {/* Highlights */}
                {details.highlights && details.highlights.length > 0 && (
                  <Box>
                    <Text fontWeight="semibold" mb="2">
                      Highlights
                    </Text>
                    <Stack as="ul" gap="2" pl="5">
                      {details.highlights.map((h, i) => (
                        <Text as="li" key={i}>
                          {h}
                        </Text>
                      ))}
                    </Stack>
                  </Box>
                )}

                {/* Responsibilities / Requirements in two columns (stack on mobile) */}
                {(details.responsibilities?.length || details.requirements?.length) && (
                  <Stack
                    direction={{ base: "column", md: "row" }}
                    gap={{ base: 4, md: 6 }}
                    align="start"
                  >
                    {details.responsibilities && details.responsibilities.length > 0 && (
                      <Box flex="1">
                        <Text fontWeight="semibold" mb="2">
                          Responsibilities
                        </Text>
                        <Stack as="ul" gap="2" pl="5">
                          {details.responsibilities.map((r, i) => (
                            <Text as="li" key={i}>
                              {r}
                            </Text>
                          ))}
                        </Stack>
                      </Box>
                    )}
                    {details.requirements && details.requirements.length > 0 && (
                      <Box flex="1">
                        <Text fontWeight="semibold" mb="2">
                          Requirements
                        </Text>
                        <Stack as="ul" gap="2" pl="5">
                          {details.requirements.map((r, i) => (
                            <Text as="li" key={i}>
                              {r}
                            </Text>
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                )}

                {/* FAQ */}
                {details.faq && details.faq.length > 0 && (
                  <Box>
                    <Text fontWeight="semibold" mb="2">
                      FAQs
                    </Text>
                    <Stack gap="3">
                      {details.faq.map((f, i) => (
                        <Box key={i} borderWidth="1px" rounded="lg" p="3" bg="bg.subtle">
                          <Text fontWeight="medium" mb="1">
                            {f.q}
                          </Text>
                          <Text color="fg.muted">{f.a}</Text>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Box>

            <Separator />

            {/* Footer actions */}
            <Box p={{ base: 4, md: 5 }} pt="0">
              <HStack justify="end" gap="2">
                <Button colorPalette="blue" borderRadius="xl" onClick={goToApplication}>
                  Continue to application
                </Button>
              </HStack>
            </Box>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
