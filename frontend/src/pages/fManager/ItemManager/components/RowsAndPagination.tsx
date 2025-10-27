import { useMemo } from "react";
import {
  Button,
  ButtonGroup,
  HStack,
  NativeSelect,
  Text,
  IconButton,
} from "@chakra-ui/react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import type { RowsAndPaginationProps } from "../types";

function buildPages(total: number, current: number) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) pages.push("...");
  for (let p = left; p <= right; p++) pages.push(p);
  if (right < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}

export default function RowsAndPagination({
  limit,
  pages,
  currentPage,
  onLimitChange,
  onPageChange,
}: RowsAndPaginationProps) {
  const pageItems = useMemo(() => buildPages(pages, currentPage), [pages, currentPage]);

  const canPrev = currentPage > 1;
  const canNext = currentPage < pages;

  const pager =
    pages > 1 ? (
      <HStack gap="1">
        <IconButton
          aria-label="First page"
          size="sm"
          variant="ghost"
          onClick={() => onPageChange(1)}
          disabled={!canPrev}
        >
          <ChevronsLeft size={16} />
        </IconButton>
        <IconButton
          aria-label="Previous page"
          size="sm"
          variant="ghost"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canPrev}
        >
          <ChevronLeft size={16} />
        </IconButton>

        <ButtonGroup attached size="sm">
          {pageItems.map((p, i) =>
            p === "..." ? (
              <Button key={`d-${i}`} variant="outline" disabled>
                …
              </Button>
            ) : (
              <Button
                key={p}
                variant={p === currentPage ? "solid" : "outline"}
                colorPalette={p === currentPage ? "teal" : undefined}
                aria-current={p === currentPage ? "page" : undefined}
                onClick={() => onPageChange(p as number)}
              >
                {p}
              </Button>
            )
          )}
        </ButtonGroup>

        <IconButton
          aria-label="Next page"
          size="sm"
          variant="ghost"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canNext}
        >
          <ChevronRight size={16} />
        </IconButton>
        <IconButton
          aria-label="Last page"
          size="sm"
          variant="ghost"
          onClick={() => onPageChange(pages)}
          disabled={!canNext}
        >
          <ChevronsRight size={16} />
        </IconButton>
      </HStack>
    ) : null;

  return (
    <HStack p={3} borderTopWidth="1px" justify="space-between" wrap="wrap" gap="3">
      <HStack>
        <Text fontSize="sm">Rows:</Text>
        <NativeSelect.Root width="80px">
          <NativeSelect.Field
            value={String(limit)}
            onChange={(e) => onLimitChange(Number(e.target.value))}
          >
            {[5, 10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </HStack>

      {pager}
    </HStack>
  );
}
