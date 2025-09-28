import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  HStack,
  Icon,
  Input,
  Kbd,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useClickAway } from "react-use";
import { FiSearch, FiShoppingBag, FiUser } from "react-icons/fi";
import type { SearchSuggestion } from "../hooks/useMarketSearchIndex";

export type SearchAutocompleteProps = {
  value: string;
  onChange: (text: string) => void;
  suggestions: SearchSuggestion[];
  onPick: (s: SearchSuggestion) => void;
  placeholder?: string;
  openOnFocusEmpty?: boolean;
  dropdownZIndex?: number;
  maxDropdownHeight?: string;
  minWidth?: string | number;
  width?: string | number;
};

function SearchAutocompleteBase({
  value,
  onChange,
  suggestions,
  onPick,
  placeholder = "Search items or farmers…",
  openOnFocusEmpty = false,
  dropdownZIndex = 20,
  maxDropdownHeight = "14rem",
  minWidth,
  width,
}: SearchAutocompleteProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number>(0);

  // ✅ Correct hook in Chakra v3
  useClickAway(rootRef, () => setOpen(false));


  const canOpen = useMemo(() => {
    const hasQuery = (value?.trim()?.length ?? 0) > 0;
    return (openOnFocusEmpty || hasQuery) && suggestions.length > 0;
  }, [value, suggestions.length, openOnFocusEmpty]);

  useEffect(() => {
    if (activeIdx >= suggestions.length) {
      setActiveIdx(Math.max(0, suggestions.length - 1));
    }
  }, [activeIdx, suggestions.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!canOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setActiveIdx((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        if (suggestions[activeIdx]) {
          e.preventDefault();
          onPick(suggestions[activeIdx]);
          setOpen(false);
        }
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    },
    [activeIdx, canOpen, onPick, suggestions]
  );

  return (
    <Box ref={rootRef} position="relative" minW={minWidth} w={width}>
      {/* Input shell */}
      <HStack
        borderWidth="1px"
        rounded="lg"
        px="3"
        py="2"
        gap="2"
        _focusWithin={{
          borderColor: "teal.500",
          boxShadow: "0 0 0 1px var(--chakra-colors-teal-500)",
        }}
      >
        <Icon as={FiSearch} color="fg.muted" />
        <Input
          ref={inputRef}
          variant="outline"
          placeholder={placeholder}
          value={value}
          onFocus={() => canOpen && setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            if (!open && canOpen) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
        <HStack gap="1" color="fg.muted" display={{ base: "none", md: "flex" }}>
          <Kbd>Enter</Kbd>
          <Text fontSize="xs">to select</Text>
        </HStack>
      </HStack>

      {/* Dropdown */}
      {open && canOpen ? (
        <Box
          role="listbox"
          aria-label="Search suggestions"
          position="absolute"
          left={0}
          right={0}
          mt="1"
          borderWidth="1px"
          rounded="md"
          bg="bg.panel"
          boxShadow="md"
          maxH={maxDropdownHeight}
          overflowY="auto"
          zIndex={dropdownZIndex}
        >
          {suggestions.map((s, idx) => {
            const active = idx === activeIdx;
            return (
              <HStack
                key={`${s.kind}:${s.key}`}
                as="button"
                role="option"
                aria-selected={active}
                w="100%"
                textAlign="left"
                px="3"
                py="2"
                gap="2"
                bg={active ? "bg.subtle" : undefined}
                _hover={{ bg: "bg.subtle" }}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(s);
                  setOpen(false);
                  inputRef.current?.focus();
                }}
              >
                <Icon as={s.kind === "item" ? FiShoppingBag : FiUser} />
                <Stack gap="0" align="start">
                  <Text fontSize="sm">{s.label}</Text>
                  {s.secondary ? (
                    <Text fontSize="xs" color="fg.muted">
                      {s.secondary}
                    </Text>
                  ) : null}
                </Stack>
              </HStack>
            );
          })}
        </Box>
      ) : null}
    </Box>
  );
}

export const SearchAutocomplete = memo(SearchAutocompleteBase);
