import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardHeader,
  CardBody,
  Flex,
  Heading,
  HStack,
  Text,
  Icon,
  Separator,
  Spinner,
} from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { StyledIconButton } from "@/components/ui/IconButton";
import { FiPlus, FiRefreshCcw, FiArrowLeft, FiArrowRight } from "react-icons/fi";
import PackageSizeTable from "./components/PackageSizeTable";
import PackageSizeForm from "./components/PackageSizeForm";
import DeleteConfirm from "./components/DeleteConfirm";
import PackageSizeViewModal from "./components/PackageSizeViewModal";
import {
  listPackageSizes,
  createPackageSize,
  updatePackageSize,
  deletePackageSize,
} from "@/api/packageSizes";
import type { PackageSize } from "@/types/package-sizes";
import { toaster } from "@/components/ui/toaster";

type Pager = { page: number; limit: number; total: number };

export default function PackageSizesPage() {
  const [items, setItems] = useState<PackageSize[]>([]);
  const [pager, setPager] = useState<Pager>({ page: 1, limit: 10, total: 0 });
  const [sort, setSort] = useState<string>("key");
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PackageSize | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<PackageSize | null>(null);

  const fetchData = async (args?: Partial<{ page: number; limit: number; sort: string }>) => {
    setLoading(true);
    try {
      const res = await listPackageSizes({
        page: args?.page ?? pager.page,
        limit: args?.limit ?? pager.limit,
        sort: args?.sort ?? sort,
      });
      setItems(res.items);
      setPager({ page: res.page, limit: res.limit, total: res.total });
    } catch (e: any) {
      toaster.create({
        type: "error",
        title: "Failed to load",
        description: e?.response?.data?.message ?? e?.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(pager.total / pager.limit)),
    [pager.total, pager.limit]
  );

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const onSubmit = async (values: Partial<PackageSize>) => {
    if (editing?._id || editing?.key) {
      const id = editing._id ?? editing.key!;
      const updated = await updatePackageSize(id, values);
      setItems((prev) =>
        prev.map((it) => (it._id === updated._id || it.key === updated.key ? updated : it))
      );
      toaster.create({ type: "success", title: "Updated", description: updated.name });
    } else {
      const created = await createPackageSize(values);
      toaster.create({ type: "success", title: "Created", description: created.name });
      fetchData({ page: 1 });
    }
  };

  const onDelete = async (idOrKey: string) => {
    await deletePackageSize(idOrKey);
    const nextPage = items.length === 1 && pager.page > 1 ? pager.page - 1 : pager.page;
    await fetchData({ page: nextPage });
  };

  return (
    <Box p={{ base: 4, md: 6 }}>
      <Card.Root rounded="2xl" shadow="md" borderWidth="1px">
        <CardHeader borderBottomWidth="1px" >
          <Flex align="center" justify="space-between" wrap="wrap" gap="3">
            <Heading size="lg">Package Sizes</Heading>
            <HStack>
              <Tooltip content="Reload">
                <StyledIconButton aria-label="Reload" variant="ghost" onClick={() => fetchData()}>
                  <Icon as={FiRefreshCcw} />
                </StyledIconButton>
              </Tooltip>
              <StyledIconButton onClick={openCreate} colorPalette="teal">
                <Icon as={FiPlus} /> New
              </StyledIconButton>
            </HStack>
          </Flex>
        </CardHeader>

        <CardBody>
          <PackageSizeTable
            items={items}
            onDelete={(it) => setToDelete(it._id ?? it.key)}
            onView={(it) => setViewItem(it)} // "Edit" opens the modal form
            sort={sort}
            onSort={setSort}
          />

          <Flex mt="4" justify="space-between" align="center" wrap="wrap" gap="2">
            <Text color="fg.muted" fontSize="sm">
              Showing {items.length ? (pager.page - 1) * pager.limit + 1 : 0}–{" "}
              {(pager.page - 1) * pager.limit + items.length} of {pager.total}
            </Text>
            <HStack>
              <Tooltip content="Previous">
                <StyledIconButton
                  aria-label="Previous"
                  disabled={pager.page <= 1 || loading}
                  onClick={() => fetchData({ page: Math.max(1, pager.page - 1) })}
                >
                  <Icon as={FiArrowLeft} />
                </StyledIconButton>
              </Tooltip>
              <Text fontWeight="medium">
                {loading && <Spinner size="xs" mr="2" />} Page {pager.page} / {totalPages}
              </Text>
              <Tooltip content="Next">
                <StyledIconButton
                  aria-label="Next"
                  disabled={pager.page >= totalPages || loading}
                  onClick={() => fetchData({ page: Math.min(totalPages, pager.page + 1) })}
                >
                  <Icon as={FiArrowRight} />
                </StyledIconButton>
              </Tooltip>
            </HStack>
          </Flex>
        </CardBody>
      </Card.Root>

      {/* Create form */}
      <PackageSizeForm
        open={formOpen}
        initial={editing ?? undefined}
        onClose={() => setFormOpen(false)}
        onSubmit={onSubmit}
      />

      {/* Edit/View modal with interactive shape */}
      <PackageSizeViewModal
        item={viewItem}
        onClose={() => setViewItem(null)}
        onSave={async (idOrKey, patch) => {
          try {
            const updated = await updatePackageSize(idOrKey, patch);
            setItems((prev) =>
              prev.map((it) =>
                (it._id ?? it.key) === (updated._id ?? updated.key) ? updated : it
              )
            );
            toaster.create({
              type: "success",
              title: "Saved changes",
              description: updated.name,
            });
            setViewItem(updated);
          } catch (e: any) {
            toaster.create({
              type: "error",
              title: "Update failed",
              description: e?.response?.data?.message ?? e?.message ?? "Unknown error",
            });
          }
        }}
      />

      <DeleteConfirm idOrKey={toDelete} onConfirm={onDelete} onClose={() => setToDelete(null)} />
    </Box>
  );
}
