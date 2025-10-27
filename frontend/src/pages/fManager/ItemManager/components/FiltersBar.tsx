/** @jsxImportSource @emotion/react */
import * as React from "react";
import { css } from "@emotion/react";
import {
  Box,
  HStack,
  Input,
  NativeSelect,
  Text,
  IconButton,
  Button,
} from "@chakra-ui/react";
import { X, RotateCcw } from "lucide-react";
import type { FiltersBarProps } from "../types";

const DEBOUNCE_MS = 300;

/* ===== New look: amber–purple theme, chunkier fields, pill reset ===== */
const wrapCss = css`
  position: relative;
  padding: 18px;
  border-radius: 18px;
  background:
    radial-gradient(1200px 380px at 120% -40%, var(--chakra-colors-amber-50), transparent),
    radial-gradient(900px 360px at -10% 130%, var(--chakra-colors-purple-50), transparent),
    var(--chakra-colors-bg-panel, var(--chakra-colors-bg));
  border: 1px solid var(--chakra-colors-border);
  box-shadow: var(--chakra-shadows-sm);
`;

const accentCss = css`
  position: absolute;
  inset: 0 0 auto 0;
  height: 4px;
  border-top-left-radius: 18px;
  border-top-right-radius: 18px;
  background: linear-gradient(
    90deg,
    var(--chakra-colors-amber-400),
    var(--chakra-colors-orange-400),
    var(--chakra-colors-purple-500)
  );
`;

const labelCss = css`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 700;
  color: var(--chakra-colors-fg);
  background: color-mix(in oklab, var(--chakra-colors-amber-300) 28%, transparent);
`;

const fieldBoxCss = css`
  padding: 12px;
  border-radius: 14px;
  background: var(--chakra-colors-bg);
  border: 1px solid var(--chakra-colors-border);
  transition: box-shadow 0.15s ease, border-color 0.15s ease, transform 0.06s ease;
  &:focus-within {
    border-color: var(--chakra-colors-purple-500);
    box-shadow: 0 0 0 4px color-mix(in oklab, var(--chakra-colors-purple-500) 24%, transparent);
  }
  &:hover {
    transform: translateY(-1px);
  }
`;

export default function FiltersBar({ query, setQuery }: FiltersBarProps) {
  const [localQ, setLocalQ] = React.useState(query.q ?? "");

  React.useEffect(() => {
    setLocalQ(query.q ?? "");
  }, [query.q]);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setQuery((s) => ({ ...s, page: 1, q: localQ }));
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [localQ, setQuery]);

  const clearCategory = () =>
    setQuery((s) => ({ ...s, page: 1, category: "" as any }));

  const clearSearch = () => setLocalQ("");

  const resetAll = () =>
    setQuery((s) => ({
      ...s,
      page: 1,
      q: "",
      category: "" as any,
      sort: "-updatedAt,type",
    }));

  return (
    <Box css={wrapCss}>
      <Box css={accentCss} />

      <HStack gap={3} align="flex-end" wrap="wrap">
        {/* Category */}
        <Box minW="230px" css={fieldBoxCss}>
          <HStack justify="space-between" mb={2}>
            <span css={labelCss}>Category</span>
            {query.category ? (
              <IconButton
                aria-label="Clear category"
                size="xs"
                variant="ghost"
                onClick={clearCategory}
              >
                <X size={14} />
              </IconButton>
            ) : null}
          </HStack>
          <NativeSelect.Root>
            <NativeSelect.Field
              value={query.category ?? ""}
              onChange={(e) =>
                setQuery((s) => ({
                  ...s,
                  page: 1,
                  category: (e.target.value || "") as any,
                }))
              }
            >
              <option value="">All</option>
              <option value="fruit">fruit</option>
              <option value="vegetable">vegetable</option>
              <option value="dairy">dairy</option>
              <option value="breads">breads</option>
              <option value="legumes">legumes</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Box>

        {/* Search */}
        <Box flex={1} minW="320px" css={fieldBoxCss}>
          <HStack justify="space-between" mb={2}>
            <span css={labelCss}>Search</span>
            {localQ ? (
              <IconButton
                aria-label="Clear search"
                size="xs"
                variant="ghost"
                onClick={clearSearch}
              >
                <X size={14} />
              </IconButton>
            ) : null}
          </HStack>
          <Input
            placeholder="type or variety…"
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
          />
          <Text fontSize="xs" color="fg.muted" mt="1.5">
            Auto-apply on pause
          </Text>
        </Box>

        {/* Sort */}
        <Box minW="260px" css={fieldBoxCss}>
          <HStack justify="space-between" mb={2}>
            <span css={labelCss}>Sort</span>
          </HStack>
          <NativeSelect.Root>
            <NativeSelect.Field
              value={query.sort}
              onChange={(e) =>
                setQuery((s) => ({ ...s, page: 1, sort: e.target.value }))
              }
            >
              <option value="-updatedAt,type">Recently updated</option>
              <option value="type">Type ↑</option>
              <option value="-type">Type ↓</option>
              <option value="category,type">Category, Type</option>
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Box>

        {/* Reset */}
        <Button
          ml="auto"
          size="sm"
          variant="solid"
          colorPalette="purple"
          onClick={resetAll}
          borderRadius="full"
        >
          <HStack gap="1.5">
            <RotateCcw size={14} />
            <Text>Reset</Text>
          </HStack>
        </Button>
      </HStack>
    </Box>
  );
}
