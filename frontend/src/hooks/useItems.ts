// src/hooks/useItems.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  listItems,
  createItem,
  updateItemPartial,
  replaceItem,
  deleteItem,
  type ListQuery,
  type ItemFormValues,
  // type ItemsListResponse, // <- if you already export this from api/items, use it
} from "@/api/items"
import type { Item } from "@/types/items"

// If not exported from api/items, define it here:
export type ItemsListResponse = {
  items: Item[]
  total: number
  pages: number
}

const keys = {
  items: (q: ListQuery) => ["items", q] as const,
}

export function useItems(q: ListQuery) {
  return useQuery<ItemsListResponse>({
    queryKey: keys.items(q),
    queryFn: () => listItems(q),
    // v5: keepPreviousData was removed — use placeholderData to keep old data while fetching
    placeholderData: (prev) => prev, 
    staleTime: 20_000,
  })
}

export function useCreateItem(q: ListQuery) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: ItemFormValues) => createItem(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.items(q) }),
  })
}

export function useUpdateItem(q: ListQuery) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ItemFormValues> }) =>
      updateItemPartial(id, data),
    onSuccess: (_item: Item) => qc.invalidateQueries({ queryKey: keys.items(q) }),
  })
}

export function useReplaceItem(q: ListQuery) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ItemFormValues }) =>
      replaceItem(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.items(q) }),
  })
}

export function useDeleteItem(q: ListQuery) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.items(q) }),
  })
}
