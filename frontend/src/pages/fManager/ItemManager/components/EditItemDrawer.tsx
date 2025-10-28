/** @jsxImportSource @emotion/react */
import * as React from "react";
import { css } from "@emotion/react";
import {
  Badge,
  Box,
  Drawer,
  HStack,
  Kbd,
  Portal,
  Stack,
  Text,
} from "@chakra-ui/react";
import { X } from "lucide-react";
import ItemForm from "./ItemForm";
import type { Item } from "@/types/items";
import { StyledIconButton } from "@/components/ui/IconButton";

type Props = {
  open: boolean;
  setOpen: (val: boolean) => void;
  editing: Item | null;
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
const categoryColor: Record<string, string> = {
  fruit: "pink",
  vegetable: "teal",
  dairy: "blue",
  breads: "orange",
  legumes: "purple",
};


const headerCss = css`
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 20px 24px;
  background: var(--chakra-colors-bg); /* solid for readability */
  color: var(--chakra-colors-fg);
  border-bottom: 1px solid var(--chakra-colors-border);
`;

const accentCss = css`
  margin-top: 12px;
  height: 3px;
  width: 100%;
  border-radius: 9999px;
  background: linear-gradient(
    135deg,
    var(--chakra-colors-teal-400),
    var(--chakra-colors-purple-400)
  );
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

export default function EditItemDrawer({
  open,
  setOpen,
  editing,
  isSubmitting,
  onSubmit,
}: Props) {
  const title = React.useMemo(() => {
    if (!editing) return "Edit Item";
    const v = (editing.variety ?? "").trim();
    return v ? `${editing.type} ${v}` : editing.type;
  }, [editing]);

  const category = editing?.category;
  const updated = editing?.updatedAt
    ? new Date(editing.updatedAt).toLocaleString()
    : null;

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
                    <Text
                      fontSize={{ base: "xl", md: "2xl" }}
                      fontWeight="extrabold"
                      letterSpacing="tight"
                      
                    >
                      {title}
                    </Text>
                    {
                    category  && (
                      <Badge
                        color="white"
                        variant="solid"
                        fontSize="0.7rem"
                        px="2"
                        py="0.5"
                        rounded="full"
                        backgroundColor={`var(--chakra-colors-${categoryColor[category] || "gray"}-500)`}
                      >
                        {category}
                      </Badge>
                    )}
                  </HStack>

                  <HStack gap="3" color="fg.muted" fontSize={{ base: "xs", md: "sm" }}>
                    {updated && <Text>Last updated: {updated}</Text>}
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

              <Box css={accentCss} />
            </Drawer.Header>

            <Drawer.Body asChild>
              <Box css={bodyCss}>
                {editing ? (
                  <Box
                    border="1px dashed"
                    borderColor="border"
                    rounded="2xl"
                    p={{ base: 4, md: 6 }}
                    bg="bg.panel"
                    backdropFilter="saturate(120%) blur(2px)"
                  >
                    <ItemForm
                      key={editing._id ?? "edit-form"}
                      mode="edit"
                      isSubmitting={isSubmitting}
                      defaultValues={{
                        category: editing.category,
                        type: editing.type,
                        variety: editing.variety ?? "",
                        imageUrl: editing.imageUrl ?? "",
                        caloriesPer100g: editing.caloriesPer100g ?? undefined,
                        price: editing.price ?? { a: null, b: null, c: null },
                        season: editing.season ?? "",
                        tolerance: editing.tolerance ?? "",
                        qualityStandards: editing.qualityStandards ?? undefined,
                      }}
                      onSubmit={onSubmit}
                    />
                  </Box>
                ) : (
                  <Box color="fg.muted">No item selected</Box>
                )}
              </Box>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
