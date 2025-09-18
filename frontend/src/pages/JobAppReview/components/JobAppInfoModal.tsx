// src/pages/jobAppReview/components/JobAppInfoModal.tsx
import { useMemo } from "react";
import {
  Dialog,
  Box,
  HStack,
  Stack,
  Text,
  Button,
  Badge,
  Separator,
} from "@chakra-ui/react";
import type {
  JobApplicationDTO,
  JobApplicationStatus,
} from "@/types/jobApplications";
import { RolesTable } from "@/data/roles";
import { formatDMY } from "@/utils/date";
import JobAppFields from "./presenters/JobAppFields";
import SchedulePreview from "./presenters/SchedulePreview";

// Keep status→allowed transitions consistent with the table
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

const statusPalette: Record<JobApplicationStatus, string> = {
  pending: "gray",
  contacted: "purple",
  approved: "green",
  denied: "red",
};

export type JobAppInfoModalProps = {
  item: JobApplicationDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // Actions
  onChangeStatus: (id: string, next: JobApplicationStatus) => void;
  actionsDisabled?: boolean;

  // Optional UI tweaks
  scheduleVariant?: "grid" | "list";
};

export default function JobAppInfoModal({
  item,
  open,
  onOpenChange,
  onChangeStatus,
  actionsDisabled,
  scheduleVariant = "grid",
}: JobAppInfoModalProps) {
  const userObj = typeof item.user === "string" ? null : item.user;
  const applicant =
    (userObj?.name?.trim() || "(Unknown)") +
    (userObj?.email ? ` · ${userObj.email}` : "");

  const roleDef = useMemo(
    () => RolesTable.find((r) => r.name === item.appliedRole),
    [item.appliedRole]
  );

  const canUpdateTo = allowedNext(item.status);

  const includeSchedule = !!roleDef?.includeSchedule;
  const includeLand = !!roleDef?.includeLand;

  return (
    <Dialog.Root open={open} onOpenChange={(e) => onOpenChange(e.open)} placement="center">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content
          maxW={{ base: "90vw", md: "720px" }}
          maxH="85vh"
          overflow="hidden"
          borderRadius="lg"
        >
          <Dialog.Header>
            <Stack gap={1}>
              <Dialog.Title>
                <HStack gap={2} align="center">
                  <Text fontWeight="semibold">Job Application</Text>
                  <Badge
                    size="sm"
                    variant="subtle"
                    colorPalette={statusPalette[item.status]}
                    textTransform="capitalize"
                  >
                    {item.status}
                  </Badge>
                </HStack>
              </Dialog.Title>
              <Text color="fg.muted" fontSize="sm">{applicant}</Text>
              <HStack gap={3} color="fg.muted" fontSize="xs">
                <Text>Role: <Text as="span" fontWeight="medium">{item.appliedRole}</Text></Text>
                <Separator orientation="vertical" />
                <Text>Submitted: {formatDMY(item.createdAt)}</Text>
                <Separator orientation="vertical" />
                <Text>Updated: {formatDMY(item.updatedAt)}</Text>
              </HStack>
            </Stack>
            <Dialog.CloseTrigger />
          </Dialog.Header>

          <Dialog.Body overflowY="auto" px={5} py={4}>
            <Stack gap={4}>
              {/* Application meta (logistic center, etc.) */}
              <Box borderWidth="1px" borderRadius="md" p={4}>
                <Stack gap={2}>
                  <Text fontWeight="semibold">Application</Text>
                  <Separator />
                  <HStack gap={6} wrap="wrap">
                    <MetaItem label="Application ID" value={item.id} />
                    <MetaItem
                      label="Logistic Center"
                      value={item.logisticCenterId ?? "—"}
                    />
                  </HStack>
                </Stack>
              </Box>

              {/* Role-aware fields (from RolesTable) */}
              <JobAppFields item={item} title="Role Details" />

              {/* Weekly schedule (if configured for role and present) */}
              {includeSchedule ? (
                <ScheduleCard
                  item={item}
                  variant={scheduleVariant}
                />
              ) : null}

              {/* Farmer lands summary (optional spotlight, details already in JobAppFields if defined there) */}
              {includeLand ? (
                <FarmerLandsSpotlight item={item} />
              ) : null}
            </Stack>
          </Dialog.Body>

          <Dialog.Footer>
            <HStack gap={2} justify="flex-end" w="full">
              {canUpdateTo.map((opt) => (
                <Button
                  key={opt}
                  size="sm"
                  variant={opt === "denied" ? "outline" : "solid"}
                  colorPalette={
                    opt === "approved" ? "green" :
                    opt === "contacted" ? "purple" : "red"
                  }
                  onClick={() => onChangeStatus(item.id, opt)}
                  disabled={actionsDisabled}
                >
                  {opt[0].toUpperCase() + opt.slice(1)}
                </Button>
              ))}
              <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

/* ---------- Small subcomponents (v3-friendly) ---------- */

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0}>
      <Text fontSize="xs" color="fg.muted">{label}</Text>
      <Text fontSize="sm" fontWeight="medium">{value || "—"}</Text>
    </Stack>
  );
}

function ScheduleCard({
  item,
  variant,
}: {
  item: JobApplicationDTO;
  variant: "grid" | "list";
}) {
  const weekly = (item.applicationData as any)?.weeklySchedule as number[] | undefined;
  if (!weekly || !Array.isArray(weekly)) return null;

  return (
    <Box borderWidth="1px" borderRadius="md" p={4}>
      <Stack gap={2}>
        <Text fontWeight="semibold">Weekly Schedule</Text>
        <Separator />
        <SchedulePreview weeklyMask={weekly} variant={variant} />
      </Stack>
    </Box>
  );
}

function FarmerLandsSpotlight({ item }: { item: JobApplicationDTO }) {
  const lands = (item.applicationData as any)?.lands as
    | Array<{ name?: string; ownership?: string; address?: { address?: string } }>
    | undefined;

  if (!lands || lands.length === 0) return null;

  return (
    <Box borderWidth="1px" borderRadius="md" p={4}>
      <Stack gap={2}>
        <Text fontWeight="semibold">Lands</Text>
        <Separator />
        <Stack gap={2}>
          {lands.map((l, idx) => (
            <Stack key={idx} gap={0}>
              <Text fontWeight="medium">
                {l?.name || `Land ${idx + 1}`}
                {l?.ownership ? ` · ${l.ownership}` : ""}
              </Text>
              <Text fontSize="sm" color="fg.muted">
                {l?.address?.address || "—"}
              </Text>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}
