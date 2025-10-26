import type { Item, ItemCategory } from "@/types/items";

export type QueryState = {
  page: number;
  limit: number;
  category?: ItemCategory | "";
  q?: string;
  sort?: string;
};

export type RowsAndPaginationProps = {
  limit: number;
  pages: number;
  currentPage: number;
  onLimitChange: (n: number) => void;
  onPageChange: (p: number) => void;
};


export type ItemsTableProps = {
  items: Item[];
  isBusy: boolean;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
};

export type FiltersBarProps = {
  query: QueryState;
  setQuery: React.Dispatch<React.SetStateAction<QueryState>>;
};

