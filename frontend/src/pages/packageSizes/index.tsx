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
  Button,
  ButtonGroup,
    Stack, 
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
  listContainers,
  createContainer,
  updateContainer,
  deleteContainer,
} from "@/api/packageSizes";
import type { PackageSize, Container } from "@/types/package-sizes";
import { toaster } from "@/components/ui/toaster";

type Pager = { page: number; limit: number; total: number };
type Mode = "package" | "container";
type BoxLike = PackageSize | Container;

export default function PackageSizesPage() {
  const [mode, setMode] = useState<Mode>("package");

  const [items, setItems] = useState<BoxLike[]>([]);
  const [pager, setPager] = useState<Pager>({ page: 1, limit: 10, total: 0 });
  const [sort, setSort] = useState<string>("key");
  const [loading, setLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BoxLike | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<BoxLike | null>(null);

  const fetchData = async (
    args?: Partial<{ page: number; limit: number; sort: string }>
  ) => {
    setLoading(true);
    try {
      const common = {
        page: args?.page ?? pager.page,
        limit: args?.limit ?? pager.limit,
        sort: args?.sort ?? sort,
      };

      const res =
        mode === "package"
          ? await listPackageSizes(common)
          : await listContainers(common);

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
    // whenever mode or sort changes, reload from page 1
    fetchData({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, mode]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(pager.total / pager.limit)),
    [pager.total, pager.limit]
  );

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const onSubmit = async (values: Partial<BoxLike>) => {
    if (editing?._id || editing?.key) {
      const id = (editing as any)._id ?? editing.key!;
      const updated =
        mode === "package"
          ? await updatePackageSize(id, values as Partial<PackageSize>)
          : await updateContainer(id, values as Partial<Container>);

      setItems((prev) =>
        prev.map((it) =>
          ((it as any)._id ?? it.key) === ((updated as any)._id ?? updated.key)
            ? updated
            : it
        )
      );
      toaster.create({
        type: "success",
        title: "Updated",
        description: (updated as any).name,
      });
    } else {
      const created =
        mode === "package"
          ? await createPackageSize(values as Partial<PackageSize>)
          : await createContainer(values as Partial<Container>);

      toaster.create({
        type: "success",
        title: "Created",
        description: (created as any).name,
      });
      fetchData({ page: 1 });
    }
  };

  const onDelete = async (idOrKey: string) => {
    if (mode === "package") {
      await deletePackageSize(idOrKey);
    } else {
      await deleteContainer(idOrKey);
    }
    const nextPage = items.length === 1 && pager.page > 1 ? pager.page - 1 : pager.page;
    await fetchData({ page: nextPage });
  };

  const heading =
    mode === "package" ? "Package Sizes (customer boxes)" : "Containers (LC / transport)";

  return (
    <Box p={{ base: 4, md: 6 }}>
      <Card.Root rounded="2xl" shadow="md" borderWidth="1px">
        <CardHeader borderBottomWidth="1px">
          <Flex align="center" justify="space-between" wrap="wrap" gap="3">
            <Stack gap={1}>
              <Heading size="lg">{heading}</Heading>
              <Text color="fg.muted" fontSize="sm">
                Manage standard dimensions, weight limits and mixing rules.
              </Text>
            </Stack>

            <HStack>
              <ButtonGroup size="sm" variant="outline">
                <Button
                  onClick={() => setMode("package")}
                  variant={mode === "package" ? "solid" : "outline"}
                >
                  Package sizes
                </Button>
                <Button
                  onClick={() => setMode("container")}
                  variant={mode === "container" ? "solid" : "outline"}
                >
                  Containers
                </Button>
              </ButtonGroup>

              <Separator orientation="vertical" h="6" />

              <Tooltip content="Reload">
                <StyledIconButton
                  aria-label="Reload"
                  variant="ghost"
                  onClick={() => fetchData()}
                >
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
            mode={mode}
            items={items}
            onDelete={(it) => setToDelete((it as any)._id ?? it.key)}
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

      {/* Create/Edit form (simple) */}
      <PackageSizeForm
        open={formOpen}
        mode={mode}
        initial={editing ?? undefined}
        onClose={() => setFormOpen(false)}
        onSubmit={onSubmit}
      />

      {/* Edit/View modal with interactive shape */}
      <PackageSizeViewModal
        mode={mode}
        item={viewItem}
        onClose={() => setViewItem(null)}
        onSave={async (idOrKey, patch) => {
          try {
            const updated =
              mode === "package"
                ? await updatePackageSize(idOrKey, patch as Partial<PackageSize>)
                : await updateContainer(idOrKey, patch as Partial<Container>);

            setItems((prev) =>
              prev.map((it) =>
                ((it as any)._id ?? it.key) ===
                ((updated as any)._id ?? (updated as any).key)
                  ? updated
                  : it
              )
            );
            toaster.create({
              type: "success",
              title: "Saved changes",
              description: (updated as any).name,
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

      <DeleteConfirm
        mode={mode}
        idOrKey={toDelete}
        onConfirm={onDelete}
        onClose={() => setToDelete(null)}
      />
    </Box>
  );
}
