import { useMemo, useState } from "react";
import {
  Box,
  Stack,
  HStack,
  VStack,
  Text,
  Input,
  IconButton,
  Button,
  Badge,
  Separator,
  Tooltip,
  NativeSelect,
} from "@chakra-ui/react";
import { FiRefreshCw, FiSearch, FiChevronLeft, FiChevronRight } from "react-icons/fi";

import { useFarmerList } from "./hooks/useFarmerList";
import FarmerTable from "./components/FarmerTable";
import FarmerDetailsDialog from "./components/FarmerDetailsDialog";

/* --------------------------------- Helpers -------------------------------- */
// Local date formatter (kept here to avoid shared utils)
function formatCount(n?: number) {
  return typeof n === "number" ? n.toLocaleString() : "0";
}

/* -------------------------------- Component ------------------------------- */

export default function FarmerListPage() {
  // Controls
  const [search, setSearch] = useState<string>("");
  const [sort, setSort] = useState<string>("-createdAt"); // default newest first
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  // Details dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFarmerId, setSelectedFarmerId] = useState<string | null>(null);

  // Data
  const {
    items,
    total,
    pages,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useFarmerList({
    search,
    sort,
    page,
    limit,
    debounceMs: 250,
    enabled: true,
  });

  // Derived header bits
  const headerSubtitle = useMemo(() => {
    if (isLoading && !isFetching) return "Loading…";
    return `${formatCount(total)} total`;
  }, [total, isLoading, isFetching]);

  // Actions
  const handleView = (farmerId: string) => {
    setSelectedFarmerId(farmerId);
    setDialogOpen(true);
  };

  const canPrev = page > 1;
  const canNext = page < (pages || 1);

  return (
    <Stack gap={5}>
      {/* Page Header */}
      <HStack justify="space-between" align="center">
        <VStack align="start" gap={0}>
          <Text fontSize="xl" fontWeight="semibold">Farmers</Text>
          <Text fontSize="sm" color="fg.subtle">{headerSubtitle}</Text>
        </VStack>

        <HStack gap={2}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <IconButton
                aria-label="Refresh"
                size="sm"
                variant="ghost"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <FiRefreshCw />
              </IconButton>
            </Tooltip.Trigger>
            <Tooltip.Content>Refresh</Tooltip.Content>
          </Tooltip.Root>
        </HStack>
      </HStack>

      {/* Controls */}
      <HStack gap={3} wrap="wrap">
        <HStack gap={2} flex="1" minW="240px">
          <FiSearch style={{ opacity: 0.6 }} />
          <Input
            placeholder="Search farmer or farm name…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              // reset pagination when searching
              setPage(1);
            }}
          />
        </HStack>

        <NativeSelect.Root width={{ base: "100%", md: "220px" }}>
          <NativeSelect.Field
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="-createdAt">Newest first</option>
            <option value="createdAt">Oldest first</option>
            <option value="farmName">Farm name A–Z</option>
            <option value="-farmName">Farm name Z–A</option>
          </NativeSelect.Field>
        </NativeSelect.Root>

        <NativeSelect.Root width={{ base: "100%", md: "140px" }}>
          <NativeSelect.Field
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
      </HStack>

      <Separator />

      {/* Table */}
      <FarmerTable
        items={items}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        error={error}
        onRetry={refetch}
        onView={handleView}
        maxBodyHeight="58vh"
      />

      {/* Footer: pagination */}
      <HStack justify="space-between" align="center">
        <HStack gap={2}>
          <Badge variant="surface">Page {page} / {Math.max(pages || 1, 1)}</Badge>
          <Badge variant="surface">Total: {formatCount(total)}</Badge>
        </HStack>
        <HStack gap={2}>
          <IconButton
            aria-label="Previous page"
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!canPrev}
          >
            <FiChevronLeft />
          </IconButton>
          <IconButton
            aria-label="Next page"
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => (canNext ? p + 1 : p))}
            disabled={!canNext}
          >
            <FiChevronRight />
          </IconButton>
        </HStack>
      </HStack>

      {/* Details dialog */}
      <FarmerDetailsDialog
        open={dialogOpen}
        onOpenChange={(o) => setDialogOpen(o)}
        farmerId={selectedFarmerId}
        defaultTab={0}
      />
    </Stack>
  );
}
