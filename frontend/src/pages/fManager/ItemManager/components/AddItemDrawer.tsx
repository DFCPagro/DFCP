/** @jsxImportSource @emotion/react */
import * as React from "react";
import { css } from "@emotion/react";
import {
  Badge,
  Drawer,
  HStack,
  Kbd,
  Portal,
  Stack,
  Text,
  Box,
} from "@chakra-ui/react";
import { SimpleGrid } from "@chakra-ui/react";

import { X } from "lucide-react";
import ItemForm from "./ItemForm";
import { StyledIconButton } from "@/components/ui/IconButton";

type Props = {
  open: boolean;
  setOpen: (val: boolean) => void;
  isSubmitting: boolean;
  onSubmit: (values: any) => Promise<void> | void;
};

const contentCss = css`
  width: min(1080px, 100vw);
  max-width: 100%;
  height: 100%;
  background: var(--chakra-colors-bg);
  border-left: 1px solid var(--chakra-colors-border);
  box-shadow: var(--chakra-shadows-2xl);
  border-top-left-radius: 20px;
  border-bottom-left-radius: 20px;
  overflow: hidden;
`;

const headerCss = css`
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 20px 24px;
  background: var(--chakra-colors-bg);
  color: var(--chakra-colors-fg);
  border-bottom: 1px solid var(--chakra-colors-border);
`;

const bodyCss = css`
  padding: 24px;
  overflow: auto;
  height: calc(100% - 92px);
  background:
    radial-gradient(1200px 400px at 100% -100%, var(--chakra-colors-teal-50), transparent),
    radial-gradient(1000px 400px at -50% 120%, var(--chakra-colors-purple-50), transparent);
`;

const backdropCss = css`
  backdrop-filter: blur(6px);
  background: color-mix(in oklab, black 30%, transparent);
`;

export default function AddItemDrawer({
  open,
  setOpen,
  isSubmitting,
  onSubmit,
}: Props) {
  const initialFocusEl = React.useCallback(() => {
    return (
      (document.querySelector('input[placeholder="e.g. Apple"]') as HTMLElement) ||
      (document.querySelector("input,select,textarea") as HTMLElement) ||
      null
    );
  }, []);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={({ open }) => setOpen(open)}
      size="full"
      placement="end"
      restoreFocus
      preventScroll
      closeOnEscape={!isSubmitting}
      closeOnInteractOutside={!isSubmitting}
      initialFocusEl={initialFocusEl}
    >
      <Portal>
        <Drawer.Backdrop css={backdropCss} />
        <Drawer.Positioner>
          <Drawer.Content css={contentCss}>
            <Drawer.Header css={headerCss}>
              <HStack justify="space-between" align="center" w="full">
                <Stack gap="1">
                  <HStack gap="3" align="baseline">
                    <Text fontSize={{ base: "xl", md: "2xl" }} fontWeight="extrabold" letterSpacing="tight">
                      Create Item
                    </Text>
                    <Badge
                      colorScheme="pink"
                      variant="solid"
                      fontSize="0.7rem"
                      px="2"
                      py="0.5"
                      rounded="full"
                    >
                      New
                    </Badge>
                  </HStack>

                  <HStack gap="3" color="fg.muted" fontSize={{ base: "xs", md: "sm" }}>
                    <Text>Fill all required fields</Text>
                    <HStack gap="1.5" hideBelow="md">
                      <Text>Press</Text>
                      <Kbd fontSize="sm">Esc</Kbd>
                      <Text>to close</Text>
                    </HStack>
                  </HStack>
                </Stack>

                <Drawer.CloseTrigger asChild>
                  <StyledIconButton
                    aria-label="Close drawer"
                    variant="ghost"
                    size="md"
                    disabled={isSubmitting}
                  >
                    <X size={20} />
                  </StyledIconButton>
                </Drawer.CloseTrigger>
              </HStack>

              {/* thin colorful accent for style without hurting contrast */}
              <Box
                mt="3"
                h="3px"
                w="full"
                borderRadius="full"
                bg="linear-gradient(135deg, var(--chakra-colors-teal-400), var(--chakra-colors-purple-400))"
              />
            </Drawer.Header>

            <Drawer.Body asChild>
              <Box css={bodyCss}>
                <Box
                  border="1px dashed"
                  borderColor="border"
                  rounded="2xl"
                  p={{ base: 4, md: 6 }}
                  bg="bg.panel"
                  backdropFilter="saturate(120%) blur(2px)"
                >
                  <ItemForm
                    key={open ? "create-open" : "create-closed"}
                    mode="create"
                    isSubmitting={isSubmitting}
                    onSubmit={onSubmit}
                  />
                </Box>
              </Box>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
