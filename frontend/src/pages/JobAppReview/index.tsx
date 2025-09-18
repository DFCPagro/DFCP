import { useMemo, useState } from "react";
import { Box, Heading, Stack } from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import type {
  ApplicationRole,
  JobApplicationStatus,
  JobApplicationDTO,
} from "@/types/jobApplications";
import { useJobApplications } from "./hooks/useJobApplications";
import { usePatchStatus } from "./hooks/usePatchStatus";
import Filters, { type FiltersValue } from "./components/Filters";
import JobAppsTable from "./components/Table";
import Pagination from "./components/Pagination";
import JobAppInfoModal from "./components/JobAppInfoModal";

function toDateOrUndefined(s?: string | ""): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

export default function JobAppReviewPage() {
  // ----- Filters state -----
  const [filters, setFilters] = useState<FiltersValue>({
    role: "",
    status: "",
    from: "",
    to: "",
  });

  // ----- Pagination state -----
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  // Build params for the list hook (normalize empty strings → undefined)
  const params = useMemo(
    () => ({
      role: (filters.role || undefined) as ApplicationRole | undefined,
      status: (filters.status || undefined) as JobApplicationStatus | undefined,
      from: toDateOrUndefined(filters.from),
      to: toDateOrUndefined(filters.to),
      page,
      limit,
      sort: "-createdAt" as const,
      includeUser: true,
    }),
    [filters, page, limit]
  );

  // ----- Data fetch -----
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useJobApplications(params);

  // ----- Mutations -----
  const patchStatus = usePatchStatus();
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const handleChangeStatus = (id: string, next: JobApplicationStatus) => {
    setMutatingId(id);
    patchStatus.mutate(
      { id, payload: { status: next } },
      {
        onSuccess: () => {
          toaster.create({
            type: "success",
            title: "Status updated",
            description: `Application is now ${next}`,
          });
          // Keep the list fresh
          refetch();
        },
        onError: (err: any) => {
          const msg =
            err?.response?.data?.message || err?.message || "Update failed";
          toaster.create({
            type: "error",
            title: "Couldn’t update status",
            description: msg,
          });
        },
        onSettled: () => setMutatingId(null),
      }
    );
  };

  // ----- Details modal state -----
  const [selected, setSelected] = useState<JobApplicationDTO | null>(null);
  const [isInfoOpen, setInfoOpen] = useState(false);

  // ----- Handlers -----
  const handleFiltersChange = (next: FiltersValue) => {
    setFilters(next);
    setPage(1); // reset page when filters change
  };

  const handleResetFilters = () => {
    setFilters({ role: "", status: "", from: "", to: "" });
    setPage(1);
  };

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;

  const handleViewInfo = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) {
      toaster.create({
        type: "error",
        title: "Not found",
        description: `Couldn’t locate application ${id} in the current page.`,
      });
      return;
    }
    setSelected(row);
    setInfoOpen(true);
  };

  return (
    <Stack gap="5">
      <Heading size="md">Job Applications Review</Heading>

      <Filters
        value={filters}
        onChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      <JobAppsTable
        rows={rows}
        isBusy={isLoading || isFetching || patchStatus.isPending}
        error={isError ? (error as any)?.message ?? "Unknown error" : null}
        onRetry={() => refetch()}
        onViewInfo={handleViewInfo}
        onChangeStatus={handleChangeStatus}
        mutatingId={mutatingId}
      />

      <Box />
      <Pagination
        page={page}
        limit={limit}
        total={total}
        onPageChange={(p) => setPage(Math.max(1, p))}
        onLimitChange={(n) => {
          setLimit(n);
          setPage(1);
        }}
      />

      {/* Details modal */}
      {selected && (
        <JobAppInfoModal
          item={selected}
          open={isInfoOpen}
          onOpenChange={(open) => setInfoOpen(open)}
          onChangeStatus={handleChangeStatus}
          actionsDisabled={
            patchStatus.isPending && mutatingId === selected.id
          }
          scheduleVariant="grid"
        />
      )}
    </Stack>
  );
}
