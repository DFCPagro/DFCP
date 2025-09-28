import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Box,
  Button,
  HStack,
  Icon,
  IconButton,
  Input,
  Kbd,
  Menu,
  Portal,
  Show,
  Stack,
  Text,
  VisuallyHidden,
  useBreakpointValue,
} from "@chakra-ui/react"
import { FiChevronDown, FiChevronLeft, FiChevronRight, FiSearch, FiShoppingBag, FiUser } from "react-icons/fi"
import CategoryFilter, { type CatCode } from "@/components/feature/market/CategoryFilter"
import type { SortKey } from "../hooks/useMarketFilters"
import type { SearchSuggestion } from "../hooks/useMarketSearchIndex"

export type StickyFilterBarProps = {
  // Layout
  offsetTop?: number // px offset from top header (default: 0)
  zIndex?: number // stacking context (default: 10)

  // State
  category: string | null
  search: string
  sort: SortKey
  page: number
  totalPages: number
  totalItems?: number
  pageSize?: number

  // Suggestions from useMarketSearchIndex
  suggestions: SearchSuggestion[]

  // Events
  onCategoryChange: (cat: string | null) => void
  onSearchChange: (text: string) => void
  onPickSuggestion: (s: SearchSuggestion) => void
  onSortChange: (key: SortKey) => void
  onPageChange: (p: number) => void
}

function StickyFilterBarBase({
  offsetTop = 0,
  zIndex = 10,
  category,
  search,
  sort,
  page,
  totalPages,
  totalItems,
  pageSize = 16, // not used here but kept for parity / future use
  suggestions,
  onCategoryChange,
  onSearchChange,
  onPickSuggestion,
  onSortChange,
  onPageChange,
}: StickyFilterBarProps) {
  // --- search dropdown control ---
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const showDropdown = open && suggestions.length > 0 && (search?.trim()?.length ?? 0) > 0

  // close on outside click (simple, local)
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (showDropdown) document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [showDropdown])

  // keyboard nav: Enter selects first suggestion
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && suggestions[0]) {
        onPickSuggestion(suggestions[0])
        setOpen(false)
      } else if (e.key === "Escape") {
        setOpen(false)
      }
    },
    [suggestions, onPickSuggestion],
  )

  const pageLabel = useMemo(() => `${page}/${Math.max(1, totalPages)}`, [page, totalPages])

  // v3 Show: use boolean via useBreakpointValue
  const showHint = useBreakpointValue({ base: false, md: true }) ?? false

  return (
    <Box
      ref={rootRef}
      position="sticky"
      top={`${offsetTop}px`}
      zIndex={zIndex}
      bg="bg.canvas"
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
                onClick={() => setOpen(true)}
                onChange={(e) => {
                  onSearchChange(e.target.value)
                  if (!open) setOpen(true)
                }}
                onKeyDown={handleKeyDown}
                variant="subtle"
              />
              <Show when={showHint}>
                <HStack gap="1" color="fg.muted">
                  <Kbd>Enter</Kbd>
                  <Text fontSize="xs">to select</Text>
                </HStack>
              </Show>
            </HStack>

            {/* Dropdown */}
            {showDropdown ? (
              <Box
                position="absolute"
                left={0}
                right={0}
                mt={1}
                borderWidth="1px"
                borderRadius="md"
                bg="bg.panel"
                shadow="md"
                maxH="56"
                overflowY="auto"
              >
                {suggestions.map((s) => (
                  <HStack
                    key={`${s.kind}:${s.key}`}
                    as="button"
                    width="100%"
                    textAlign="left"
                    px="3"
                    py="2"
                    gap="2"
                    _hover={{ bg: "bg.subtle" }}
                    onMouseDown={(e) => e.preventDefault()} // keep focus
                    onClick={() => {
                      onPickSuggestion(s)
                      setOpen(false)
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
                ))}
              </Box>
            ) : null}
          </Box>
        </HStack>

        {/* Right: Sort + Page */}
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
          </HStack>
        </HStack>
      </HStack>
    </Box>
  )
}

function sortLabel(k: SortKey): string {
  switch (k) {
    case "priceAsc":
      return "Price ↑"
    case "priceDesc":
      return "Price ↓"
    case "nameAsc":
      return "Name A–Z"
    case "nameDesc":
      return "Name Z–A"
    case "relevance":
    default:
      return "Relevance"
  }
}

export const StickyFilterBar = memo(StickyFilterBarBase)
