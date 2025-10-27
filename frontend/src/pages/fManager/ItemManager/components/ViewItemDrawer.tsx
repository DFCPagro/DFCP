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
import { X } from "lucide-react";
import ItemForm from "./ItemForm";
import type { Item } from "@/types/items";
import { StyledIconButton } from "@/components/ui/IconButton";

type Props = {
  open: boolean;
  setOpen: (val: boolean) => void;
  item: Item | null;
};

/* ==== Sunset Neon theme + bolder sizing ==== */
const RADIUS = 26;

const contentCss = css`
  width: min(1240px, 100vw);
  height: 100%;
  background: var(--chakra-colors-bg);
  border-left: 2px solid var(--chakra-colors-border);
  border-top-left-radius: ${RADIUS}px;
  border-bottom-left-radius: ${RADIUS}px;
  overflow: hidden;
  box-shadow: var(--chakra-shadows-2xl);
`;

/* Solid header for contrast, with thin neon underbar */
const headerCss = css`
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 28px 32px 18px;
  background: var(--chakra-colors-bg);
  color: var(--chakra-colors-fg);
  border-bottom: 2px solid var(--chakra-colors-border);
`;

const neonBarCss = css`
  margin-top: 12px;
  height: 6px;
  width: 100%;
  border-radius: 9999px;
  background:
    linear-gradient(90deg,
      var(--chakra-colors-pink-400),
      var(--chakra-colors-orange-400),
      var(--chakra-colors-purple-500));
`;

/* Body background: layered gradients + soft grid */
const bodyCss = css`
  --g1: radial-gradient(1200px 520px at 110% -20%, color-mix(in oklab, var(--chakra-colors-pink-50) 70%, transparent), transparent);
  --g2: radial-gradient(1000px 520px at -20% 120%, color-mix(in oklab, var(--chakra-colors-orange-50) 70%, transparent), transparent);
  --grid: repeating-linear-gradient(
      0deg,
      color-mix(in oklab, var(--chakra-colors-purple-100) 24%, transparent) 0 1px,
      transparent 1px 24px
    ),
    repeating-linear-gradient(
      90deg,
      color-mix(in oklab, var(--chakra-colors-purple-100) 24%, transparent) 0 1px,
      transparent 1px 24px
    );
  background: var(--g1), var(--g2), var(--grid);
  padding: 32px;
  height: calc(100% - 116px);
  overflow: auto;
`;

/* Table scope: vivid accents */
const tableScopeCss = css`
  & table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    background: var(--chakra-colors-bg);
    border: 2px solid var(--chakra-colors-border);
    border-radius: ${RADIUS - 6}px;
    overflow: hidden;
    box-shadow: var(--chakra-shadows-lg);
  }
  & thead th {
    position: sticky; top: 0; z-index: 1;
    background:
      linear-gradient(0deg,
        color-mix(in oklab, var(--chakra-colors-pink-200) 35%, transparent),
        transparent),
      var(--chakra-colors-bg);
    color: var(--chakra-colors-fg);
    text-align: left;
    font-weight: 800;
    letter-spacing: 0.25px;
    font-size: 1rem;
    padding: 14px 18px;
    border-bottom: 2px solid var(--chakra-colors-border);
  }
  & tbody td {
    padding: 14px 18px;
    border-bottom: 1px solid var(--chakra-colors-border);
    font-size: 0.95rem;
    vertical-align: middle;
  }
  & tbody tr:nth-of-type(odd) td {
    background: color-mix(in oklab, var(--chakra-colors-orange-50) 42%, transparent);
  }
  & tbody tr:hover td {
    background: color-mix(in oklab, var(--chakra-colors-pink-50) 48%, transparent);
  }
  & td .chip {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 700;
    background: color-mix(in oklab, var(--chakra-colors-purple-200) 40%, transparent);
  }
`;

const cardCss = css`
  border: 2px dashed var(--chakra-colors-border);
  border-radius: ${RADIUS - 6}px;
  padding: 24px;
  background: color-mix(in oklab, var(--chakra-colors-pink-50) 18%, var(--chakra-colors-bg));
  backdrop-filter: saturate(120%) blur(2px);
`;

/* Title + subtitle styles */
const titleCss = css`
  font-size: clamp(1.6rem, 2vw + 1rem, 2.2rem);
  font-weight: 900;
  letter-spacing: -0.015em;
  line-height: 1.12;
  background: linear-gradient(90deg,
      var(--chakra-colors-pink-500),
      var(--chakra-colors-purple-600));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
`;

const subtitleCss = css`
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.76rem;
  color: var(--chakra-colors-fg-muted, var(--chakra-colors-fg));
`;

const catBadgeCss = css`
  font-size: 0.85rem;
  padding: 4px 10px;
  border-radius: 9999px;
  font-weight: 800;
  background:
    linear-gradient(90deg,
      color-mix(in oklab, var(--chakra-colors-orange-300) 60%, transparent),
      color-mix(in oklab, var(--chakra-colors-pink-300) 60%, transparent));
  color: var(--chakra-colors-fg);
`;

const backdropCss = css`
  backdrop-filter: blur(10px);
  background: color-mix(in oklab, black 36%, transparent);
`;

export default function ViewItemDrawer({ open, setOpen, item }: Props) {
  const title = React.useMemo(() => {
    if (!item) return "Item Overview";
    const v = (item.variety ?? "").trim();
    return v ? `${item.type} ${v}` : item.type;
  }, [item]);

  const category = item?.category ?? "";
  const updated = item?.updatedAt ? new Date(item.updatedAt).toLocaleString() : null;

  const initialFocusEl = React.useCallback(() => {
    return (document.querySelector('button[aria-label="Close drawer"]') as HTMLElement) || null;
  }, []);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={({ open }) => setOpen(open)}
      size="full"
      placement="end"
      restoreFocus
      preventScroll
      closeOnEscape
      closeOnInteractOutside
      initialFocusEl={initialFocusEl}
    >
      <Portal>
        <Drawer.Backdrop css={backdropCss} />
        <Drawer.Positioner>
          <Drawer.Content css={contentCss}>
            <Drawer.Header css={headerCss}>
              <HStack justify="space-between" align="center" w="full">
                <Stack gap="2">
                  <Text css={subtitleCss}>Catalog Record</Text>
                  <HStack gap="4" align="center" wrap="wrap">
                    <Text css={titleCss}>{title}</Text>
                    {category && <span css={catBadgeCss}>{category}</span>}
                  </HStack>
                  <HStack gap="3" color="fg.muted" fontSize={{ base: "sm", md: "md" }}>
                    {updated && <Text>Last updated: {updated}</Text>}
                    <HStack gap="2" hideBelow="md">
                      <Text>Press</Text>
                      <Kbd fontSize="md" px="2" py="1">Esc</Kbd>
                      <Text>to close</Text>
                    </HStack>
                  </HStack>
                </Stack>

                <Drawer.CloseTrigger asChild>
                  <StyledIconButton aria-label="Close drawer" variant="ghost" size="lg">
                    <X size={24} />
                  </StyledIconButton>
                </Drawer.CloseTrigger>
              </HStack>

              <Box css={neonBarCss} />
            </Drawer.Header>

            <Drawer.Body asChild>
              <Box css={[bodyCss, tableScopeCss]}>
                {item ? (
                  <Box css={cardCss}>
                    <ItemForm
                      key={item._id ?? "view-form"}
                      mode="edit"
                      readOnly
                      defaultValues={{
                        category: item.category,
                        type: item.type,
                        variety: item.variety ?? "",
                        imageUrl: item.imageUrl ?? "",
                        caloriesPer100g: item.caloriesPer100g ?? undefined,
                        price: item.price ?? { a: null, b: null, c: null },
                        season: item.season ?? "",
                        tolerance: item.tolerance ?? "",
                        qualityStandards: item.qualityStandards ?? undefined,
                      }}
                      onSubmit={() => {}}
                    />
                  </Box>
                ) : (
                  <Text color="fg.muted" fontSize="lg">No item selected</Text>
                )}
              </Box>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
