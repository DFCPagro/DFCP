import { useState } from "react"
import {
  Button,
  HStack,
  Heading,
  Separator,
  Stack,
  Text,
  useDisclosure,
} from "@chakra-ui/react"
import { Plus } from "lucide-react"

import FiltersBar from "./components/FiltersBar"
import ItemsCards from "./components/ItemsCards"
import RowsAndPagination from "./components/RowsAndPagination"
import AddItemDrawer from "./components/AddItemDrawer"
import EditItemDrawer from "./components/EditItemDrawer"
import DeleteDialog from "./components/DeleteDialog"

import {
  useCreateItem,
  useDeleteItem,
  useItems,
  useUpdateItem,
} from "@/hooks/useItems"
import type { Item, ItemCategory } from "@/types/items"
import { toaster } from "@/components/ui/toaster"
import type { QueryState } from "./types"

export default function ItemManager() {
  const [query, setQuery] = useState<QueryState>({
    page: 1,
    limit: 10,
    sort: "-updatedAt,type",
    q: "",
    category: "",
  })

  const { data, isLoading, isFetching } = useItems({
    page: query.page,
    limit: query.limit,
    sort: query.sort,
    category: (query.category || undefined) as ItemCategory | undefined,
    q: query.q || undefined,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pages = data?.pages ?? 1
  const isBusy = isLoading || isFetching

  const add = useDisclosure()
  const edit = useDisclosure()
  const delAlert = useDisclosure()

  const [editing, setEditing] = useState<Item | null>(null)
  const [toDelete, setToDelete] = useState<Item | null>(null)

  const createMut = useCreateItem({
    page: query.page,
    limit: query.limit,
    sort: query.sort,
    category: (query.category || undefined) as ItemCategory | undefined,
    q: query.q || undefined,
  })
  const updateMut = useUpdateItem({
    page: query.page,
    limit: query.limit,
    sort: query.sort,
    category: (query.category || undefined) as ItemCategory | undefined,
    q: query.q || undefined,
  })
  const deleteMut = useDeleteItem({
    page: query.page,
    limit: query.limit,
    sort: query.sort,
    category: (query.category || undefined) as ItemCategory | undefined,
    q: query.q || undefined,
  })

  const toastError = (title: string, description?: string) =>
    toaster.create({ type: "error", title, description })
  const toastSuccess = (title: string, description?: string) =>
    toaster.create({ type: "success", title, description })

  const onCreate = async (values: any) => {
    try {
      await createMut.mutateAsync(values)
      toastSuccess("Item created")
      add.onClose()
    } catch (e: any) {
      toastError("Create failed", e?.response?.data?.message ?? String(e))
    }
  }

  const onEditSubmit = async (values: any) => {
    if (!editing) return
    try {
      await updateMut.mutateAsync({ id: editing._id, data: values })
      toastSuccess("Item updated")
      edit.onClose()
    } catch (e: any) {
      toastError("Update failed", e?.response?.data?.message ?? String(e))
    }
  }

  const confirmDelete = (item: Item) => {
    setToDelete(item)
    delAlert.onOpen()
  }

  const doDelete = async () => {
    if (!toDelete) return
    try {
      await deleteMut.mutateAsync(toDelete._id)
      toastSuccess("Item deleted")
    } catch (e: any) {
      toastError("Delete failed", e?.response?.data?.message ?? String(e))
    } finally {
      delAlert.onClose()
      setToDelete(null)
    }
  }

  const onLimitChange = (n: number) =>
    setQuery((s) => ({ ...s, page: 1, limit: n }))

  const onPageChange = (p: number) =>
    setQuery((s) => ({ ...s, page: p }))

  return (
    <Stack gap={6} p={6}>
      <HStack justify="space-between" align="center">
        <Heading size="lg">Item Manager</Heading>
        <Button
          colorPalette="teal"
          onClick={add.onOpen}
          display="inline-flex"
          alignItems="center"
          gap="2"
        >
          <Plus size={16} />
          Add Item
        </Button>
      </HStack>

      <FiltersBar query={query} setQuery={setQuery} />

      <Separator />

      <Text fontSize="sm" color="fg.muted" mt="-2">
        {total} total
      </Text>

      {/* Card grid view */}
      <ItemsCards
        items={items}
        isBusy={isBusy}
        onEdit={(it) => {
          setEditing(it)
          edit.onOpen()
        }}
        onDelete={confirmDelete}
      />

      <RowsAndPagination
        limit={query.limit}
        pages={pages}
        currentPage={query.page}
        onLimitChange={onLimitChange}
        onPageChange={onPageChange}
      />

      <AddItemDrawer
        open={add.open}
        setOpen={add.setOpen}
        isSubmitting={createMut.isPending}
        onSubmit={onCreate}
      />

      <EditItemDrawer
        open={edit.open}
        setOpen={(o) => {
          edit.setOpen(o)
          if (!o) setEditing(null)
        }}
        editing={editing}
        isSubmitting={updateMut.isPending}
        onSubmit={onEditSubmit}
      />

      <DeleteDialog
        open={delAlert.open}
        setOpen={delAlert.setOpen}
        item={toDelete}
        onConfirm={doDelete}
        isLoading={deleteMut.isPending}
      />
    </Stack>
  )
}
