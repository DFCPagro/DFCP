import {
  Badge,
  Box,
  Button,
  HStack,
  Menu,
  Portal,
  Spinner,
  Table,
  Text,
} from "@chakra-ui/react";
import { ChevronDown, Eye } from "lucide-react";
import { formatDMY } from "@/utils/date";
import type {
  JobApplicationDTO,
  JobApplicationStatus,
} from "@/types/jobApplications";
import { StyledIconButton } from "@/components/ui/IconButton";

type Props = {
  rows: JobApplicationDTO[];
  isBusy?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onViewInfo?: (id: string) => void;
  onChangeStatus: (id: string, next: JobApplicationStatus) => void;
  /** If provided, disables that row's actions while a mutation is in-flight */
  mutatingId?: string | null;
};

const allowedNext = (status: JobApplicationStatus): JobApplicationStatus[] => {
  switch (status) {
    case "pending":
      return ["contacted", "approved", "denied"];
    case "contacted":
      return ["approved", "denied"];
    default:
      return [];
  }
};

const roleLabel: Record<string, string> = {
  deliverer: "Deliverer",
  industrialDeliverer: "Industrial Deliverer",
  farmer: "Farmer",
  picker: "Picker",
  sorter: "Sorter",
};

const statusPalette: Record<JobApplicationStatus, string> = {
  pending: "gray",
  contacted: "purple",
  approved: "green",
  denied: "red",
};

export default function JobAppsTable({
  rows,
  isBusy,
  error,
  onRetry,
  onViewInfo,
  onChangeStatus,
  mutatingId,
}: Props) {
  return (
    <Box borderWidth="1px" borderRadius="md" overflow="hidden">
      {/* Header bar */}
      <Box
        px={4}
        py={2}
        borderBottomWidth="1px"
        display="flex"
        alignItems="center"
        gap={3}
      >
        <Box fontWeight="semibold">Job Applications</Box>
        {isBusy && <Spinner size="sm" />}
        <Box flex="1" />
        {error ? (
          <HStack gap="2">
            <Text color="fg.error" fontSize="sm">
              Couldn’t load applications
            </Text>
            {onRetry && (
              <Button size="xs" variant="outline" onClick={onRetry}>
                Retry
              </Button>
            )}
          </HStack>
        ) : null}
      </Box>

      <Table.ScrollArea>
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Applicant</Table.ColumnHeader>
              <Table.ColumnHeader>Role</Table.ColumnHeader>
              <Table.ColumnHeader>Status</Table.ColumnHeader>
              <Table.ColumnHeader>Submitted</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Actions</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {/* Loading skeleton rows */}
            {isBusy && rows.length === 0
              ? Array.from({ length: 8 }).map((_, i) => (
                <Table.Row key={`sk-${i}`}>
                  <Table.Cell colSpan={5}>
                    <Box height="18px" bg="bg.muted" borderRadius="sm" />
                  </Table.Cell>
                </Table.Row>
              ))
              : null}

            {/* Data rows */}
            {rows.map((row) => {
              const userObj = typeof row.user === "string" ? null : row.user;
              const applicant =
                (userObj?.name?.trim() || "(Unknown)") +
                (userObj?.email ? ` · ${userObj.email}` : "");
              const nextOptions = allowedNext(row.status);
              const actionsDisabled =
                nextOptions.length === 0 || mutatingId === row.id;

              return (
                <Table.Row key={row.id}>
                  <Table.Cell>
                    <Text fontWeight="medium">{applicant}</Text>
                  </Table.Cell>

                  <Table.Cell>
                    {roleLabel[row.appliedRole] ?? row.appliedRole}
                  </Table.Cell>

                  <Table.Cell>
                    <Badge
                      size="sm"
                      variant="subtle"
                      colorPalette={statusPalette[row.status]}
                      textTransform="capitalize"
                    >
                      {row.status}
                    </Badge>
                  </Table.Cell>


                  <Table.Cell>{formatDMY(row.createdAt)}</Table.Cell>

                  <Table.Cell textAlign="end">
                    <HStack justify="flex-end" gap="1">
                      {/* Status menu (Chakra v3 slot API) */}
                      <Menu.Root>
                        <Menu.Trigger asChild>
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={actionsDisabled}
                          >
                            <HStack gap="1">
                              <Text>Update</Text>
                              <ChevronDown size={14} />
                            </HStack>
                          </Button>
                        </Menu.Trigger>
                        <Portal>
                          <Menu.Positioner>
                            <Menu.Content>
                              {nextOptions.map((opt) => (
                                <Menu.Item
                                  key={opt}
                                  value={opt}                         // ✅ required in v3
                                  onSelect={() => onChangeStatus(row.id, opt)}  // ✅ use onSelect
                                  textTransform="capitalize"
                                >
                                  {opt}
                                </Menu.Item>

                              ))}
                            </Menu.Content>
                          </Menu.Positioner>
                        </Portal>
                      </Menu.Root>

                      {/* View info */}
                      <StyledIconButton
                        size="xs"
                        variant="ghost"
                        aria-label="View info"
                        onClick={() => onViewInfo?.(row.id)}
                      >
                        <Eye size={16} />
                      </StyledIconButton>
                    </HStack>
                  </Table.Cell>
                </Table.Row>
              );
            })}

            {/* Empty state */}
            {rows.length === 0 && !isBusy && !error && (
              <Table.Row>
                <Table.Cell colSpan={5}>
                  <Box py={6} textAlign="center" color="fg.muted">
                    No applications found
                  </Box>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Root>
      </Table.ScrollArea>
    </Box>
  );
}
