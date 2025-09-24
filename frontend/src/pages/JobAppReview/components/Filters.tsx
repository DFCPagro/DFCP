// src/pages/JobAppReview/components/Filters.tsx
import { Stack, VStack, Field, NativeSelect, Input, Button } from "@chakra-ui/react";
import type { ApplicationRole, JobApplicationStatus } from "@/types/jobApplications";

export type FiltersValue = {
  role?: ApplicationRole | "";
  status?: JobApplicationStatus | "";
  from?: string | ""; // "YYYY-MM-DD"
  to?: string | "";
};

type Props = {
  value: FiltersValue;
  onChange: (next: FiltersValue) => void;
  onReset?: () => void;
};

const ROLE_OPTIONS: Array<{ label: string; value: ApplicationRole }> = [
  { label: "Deliverer", value: "deliverer" },
  { label: "Industrial Deliverer", value: "industrialDeliverer" },
  { label: "Farmer", value: "farmer" },
  { label: "Picker", value: "picker" },
  { label: "Sorter", value: "sorter" },
];

const STATUS_OPTIONS: Array<{ label: string; value: JobApplicationStatus }> = [
  { label: "Pending", value: "pending" },
  { label: "Contacted", value: "contacted" },
  { label: "Approved", value: "approved" },
  { label: "Denied", value: "denied" },
];

export default function Filters({ value, onChange, onReset }: Props) {
  return (
    <Stack gap="4" width="full" direction="row" justify="space-between">
        {/* Role */}
        <Field.Root>
          <Field.Label>Role</Field.Label>
          <NativeSelect.Root size="sm" width="220px">
            <NativeSelect.Field
              placeholder="All roles"
              value={value.role ?? ""}
              onChange={(e) =>
                onChange({ ...value, role: (e.currentTarget.value || "") as FiltersValue["role"] })
              }
            >
              <option value="">All</option>
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>

        {/* Status */}
        <Field.Root>
          <Field.Label>Status</Field.Label>
          <NativeSelect.Root size="sm" width="220px">
            <NativeSelect.Field
              placeholder="All statuses"
              value={value.status ?? ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  status: (e.currentTarget.value || "") as FiltersValue["status"],
                })
              }
            >
              <option value="">All</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>

        {/* From */}
        <Field.Root>
          <Field.Label>From</Field.Label>
          <Input
            size="sm"
            type="date"
            value={value.from ?? ""}
            onChange={(e) => onChange({ ...value, from: e.currentTarget.value })}
            width="180px"
          />
        </Field.Root>

        {/* To */}
        <Field.Root>
          <Field.Label>To</Field.Label>
          <Input
            size="sm"
            type="date"
            value={value.to ?? ""}
            onChange={(e) => onChange({ ...value, to: e.currentTarget.value })}
            width="180px"
          />
        </Field.Root>

        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onReset
              ? onReset()
              : onChange({ role: "", status: "", from: "", to: "" })
          }
        >
          Clear filters
        </Button>
    </Stack>
  );
}
