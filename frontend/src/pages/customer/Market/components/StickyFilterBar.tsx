import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  HStack,
  Icon,
  IconButton,
  Input,
  Menu,
  Portal,
  Stack,
  Text,
  VisuallyHidden,
  useBreakpointValue,
} from "@chakra-ui/react";
import {
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiSearch,
  FiShoppingBag,
  FiUser,
} from "react-icons/fi";
import CategoryFilter, { type CatCode } from "@/components/feature/market/CategoryFilter";
import type { SortKey } from "../hooks/useMarketFilters";
import type { SearchSuggestion } from "../hooks/useMarketSearchIndex";

export type StickyFilterBarProps = {
  // Layout
  offsetTop?: number;
  zIndex?: number;

  // Unit toggle
  unit: boolean;
  onUnitChange: (next: boolean) => void;

  // State
  category: string | null;
  search: string;
  sort: SortKey;
  page: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;

  // Suggestions
  suggestions: SearchSuggestion[];

  // Events
  onCategoryChange: (cat: string | null) => void;
  onSearchChange: (text: string) => void;
  onPickSuggestion: (s: SearchSuggestion) => void;
  onSortChange: (key: SortKey) => void;
  onPageChange: (p: number) => void;
};

function StickyFilterBarBase({
  offsetTop = 0,
  zIndex = 10,
  unit,
  onUnitChange,
  category,
  search,
  sort,
  page,
  totalPages,
  totalItems,
  pageSize = 16,
  suggestions,
  onCategoryChange,
  onSearchChange,
  onPickSuggestion,
  onSortChange,
  onPageChange,
}: StickyFilterBarProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] =
    useState<{ left: number; top: number; width: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const showDropdown = open && suggestions.length > 0 && (search?.trim()?.length ?? 0) > 0;
  const listboxId = "market-search-suggestions";

  const updateDropdownPos = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setDropdownPos({ left: Math.round(r.left), top: Math.round(r.bottom), width: Math.round(r.width) });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateDropdownPos();

    const onScroll = () => updateDropdownPos();
    const onResize = () => updateDropdownPos();

    const scrollHandler = () => requestAnimationFrame(onScroll);
    const resizeHandler = () => requestAnimationFrame(onResize);

    window.addEventListener("scroll", scrollHandler, true);
    window.addEventListener("resize", resizeHandler);

    return () => {
      window.removeEventListener("scroll", scrollHandler, true);
      window.removeEventListener("resize", resizeHandler);
    };
  }, [open, updateDropdownPos, search]);

  useEffect(() => {
    if (showDropdown) setActiveIndex(0);
    else setActiveIndex(-1);
  }, [showDropdown, suggestions]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showDropdown) {
        if ((e.key === "ArrowDown" || e.key === "ArrowUp") && suggestions.length > 0) {
          setOpen(true);
          setActiveIndex(0);
          e.preventDefault();
        }
        if (e.key === "Escape" || e.key === "Tab") setOpen(false);
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const s = suggestions[activeIndex] ?? suggestions[0];
        if (s) {
          onSearchChange(s.label);
          onPickSuggestion(s);
          setOpen(false);
        }
      } else if (e.key === "Escape" || e.key === "Tab") {
        setOpen(false);
      }
    },
    [showDropdown, suggestions, activeIndex, onPickSuggestion, onSearchChange]
  );

  const pageLabel = useMemo(() => `${page}/${Math.max(1, totalPages)}`, [page, totalPages]);
  const showRightSide = useBreakpointValue({ base: true, md: true }) ?? true;

  return (
    <Box
      ref={rootRef}
      position="sticky"
      top={`${offsetTop}px`}
      zIndex={zIndex}
      bg="bg"
      borderBottomWidth="1px"
      px={{ base: 3, md: 4 }}
      py={3}
    >
      <HStack gap={3} align="center" justifyContent="space-between" width="full" overflowX="auto">
        {/* Left: Category + Search */}
        <HStack gap={3} minW="0" flex="1 1 auto">
          <CategoryFilter
            value={(category as CatCode) ?? null}
            onChange={(val) => onCategoryChange(val ?? null)}
          />

          <Box position="relative" minW={{ base: "200px", md: "320px" }} flex="1 1 320px">
            <HStack
              borderWidth="1px"
              borderRadius="lg"
              px={3}
              py={2}
              gap={2}
              _focusWithin={{
                borderColor: "teal.500",
                shadow: "0 0 0 1px var(--chakra-colors-teal-500)",
              }}
            >
              <Icon as={FiSearch} color="fg.muted" />

              <Input
                id="market-search"
                ref={inputRef}
                aria-label="Search items or farmers"
                placeholder="Search items or farmers…"
                value={search}
                onClick={() => {
                  setOpen(true);
                  updateDropdownPos();
                }}
                onFocus={() => {
                  setOpen(true);
                  updateDropdownPos();
                }}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  if (!open) setOpen(true);
                  updateDropdownPos();
                }}
                onKeyDown={handleKeyDown}
                aria-autocomplete="list"
                aria-expanded={showDropdown}
                aria-controls={showDropdown ? listboxId : undefined}
                aria-activedescendant={
                  showDropdown && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
                }
              />
            </HStack>

            {showDropdown && dropdownPos ? (
              <Portal>
                <Box
                  ref={dropdownRef}
                  id={listboxId}
                  role="listbox"
                  aria-label="Search suggestions"
                  position="fixed"
                  left={`${dropdownPos.left}px`}
                  top={`${dropdownPos.top}px`}
                  width={`${dropdownPos.width}px`}
                  borderWidth="1px"
                  borderRadius="md"
                  bg="bg.panel"
                  boxShadow="lg"
                  maxH="14rem"
                  overflowY="auto"
                  zIndex="modal"
                >
                  {suggestions.map((s, idx) => {
                    const isActive = idx === activeIndex;
                    return (
                      <HStack
                        key={`${s.kind}:${s.key}`}
                        id={`${listboxId}-opt-${idx}`}
                        as="button"
                        role="option"
                        aria-selected={isActive ? "true" : "false"}
                        w="100%"
                        textAlign="left"
                        px="3"
                        py="2"
                        gap="2"
                        bg={isActive ? "bg.emphasized" : undefined}
                        _hover={{ bg: "bg.subtle" }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => {
                          onSearchChange(s.label);
                          onPickSuggestion(s);
                          setOpen(false);
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
              </Portal>
            ) : null}
          </Box>
        </HStack>

        {/* Right: Sort + Page */}
        {showRightSide ? (
          <HStack gap={2} flexShrink={0}>
            <Menu.Root>
              <Menu.Trigger asChild>
                <Button size="sm" variant="outline">
                  {sortLabel(sort)}
                  <Icon as={FiChevronDown} ml="2" />
                </Button>
              </Menu.Trigger>
              <Portal>
                <Menu.Positioner>
                  <Menu.Content>
                    <Menu.Item value="relevance" onClick={() => onSortChange("relevance")}>
                      {sortLabel("relevance")}
                    </Menu.Item>
                    <Menu.Item value="priceAsc" onClick={() => onSortChange("priceAsc")}>
                      {sortLabel("priceAsc")}
                    </Menu.Item>
                    <Menu.Item value="priceDesc" onClick={() => onSortChange("priceDesc")}>
                      {sortLabel("priceDesc")}
                    </Menu.Item>
                    <Menu.Item value="nameAsc" onClick={() => onSortChange("nameAsc")}>
                      {sortLabel("nameAsc")}
                    </Menu.Item>
                    <Menu.Item value="nameDesc" onClick={() => onSortChange("nameDesc")}>
                      {sortLabel("nameDesc")}
                    </Menu.Item>
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>

            <HStack gap={1}>
              <VisuallyHidden>
                <Text>Pagination</Text>
              </VisuallyHidden>
              <IconButton
                aria-label="Previous page"
                size="sm"
                variant="outline"
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page <= 1}
              >
                <FiChevronLeft />
              </IconButton>
              <Text minW="40px" textAlign="center" fontSize="sm">
                {pageLabel}
              </Text>
              <IconButton
                aria-label="Next page"
                size="sm"
                variant="outline"
                onClick={() => onPageChange(Math.min(Math.max(1, totalPages), page + 1))}
                disabled={page >= totalPages}
              >
                <FiChevronRight />
              </IconButton>

              {typeof totalItems === "number" ? (
                <Text fontSize="sm" color="fg.muted" ml="2">
                  {totalItems} items
                </Text>
              ) : null}

              <Button
                size="sm"
                variant="outline"
                onClick={() => onUnitChange(!unit)}
                aria-pressed={unit}
              >
                {unit ? "Units" : "Kg"}
              </Button>
            </HStack>
          </HStack>
        ) : null}
      </HStack>
    </Box>
  );
}

function sortLabel(k: SortKey): string {
  switch (k) {
    case "priceAsc":
      return "Price ↑";
    case "priceDesc":
      return "Price ↓";
    case "nameAsc":
      return "Name A–Z";
    case "nameDesc":
      return "Name Z–A";
    case "relevance":
    default:
      return "Relevance";
  }
}

export const StickyFilterBar = memo(StickyFilterBarBase);
