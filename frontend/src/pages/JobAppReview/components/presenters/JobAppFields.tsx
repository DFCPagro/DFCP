// src/pages/jobAppReview/components/presenters/JobAppFields.tsx
import { memo, useMemo } from "react";
import {
  Box,
  Separator,
  Heading,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import type { JobApplicationDTO } from "@/types/jobApplications";
import { RolesTable, type RoleDef, type RoleField } from "@/data/roles";

// ---------- Types ----------
export type JobAppFieldsProps = {
  /** The whole application row (we only read appliedRole + applicationData) */
  item: JobApplicationDTO;
  /** Section title shown at top (optional, e.g., "Role Details") */
  title?: string;
  /** Show section headings based on stepsMeta (default: true) */
  showStepHeadings?: boolean;
  /** Use a 2-col grid for label/value pairs (default: true) */
  twoColumn?: boolean;
  /** Placeholder for missing values (default: "—") */
  emptyPlaceholder?: string;

  hideFields?: string[] | ((field: RoleField, key: string) => boolean);

};

// ---------- Helpers ----------
function toCamelKey(label: string) {
  // Derive a best-effort key when `name` is not provided on RoleField
  return label
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter(Boolean)
    .map((w, i) =>
      i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    )
    .join("");
}

function resolveFieldKey(field: RoleField) {
  return field.name ?? toCamelKey(field.label);
  
}

function formatValue(
  field: RoleField,
  value: unknown,
  empty: string
): string {
  const t = field.type;

  if (value == null || value === "" || (typeof value === "number" && !isFinite(value))) {
    // numbers with value 0 are valid → do not treat as empty
    if (value === 0) return "0";
    return empty;
  }

  switch (t) {
    case "checkbox":
      return (value as boolean) ? "Yes" : "No";

    case "number":
      return String(value);

    case "email":
    case "tel":
    case "text":
      return String(value);

    case "select": {
      // Show the label from options if possible; fall back to the raw value
      const opt = field.options?.find((o) => o.value === value);
      return opt?.label ?? String(value);
    }

    case "dimensions": {
      // Expecting an object like { height, length, width } in cm/m/in per RoleField.unit
      const v = value as any;
      const unit = field.unit ?? "cm";
      const parts: string[] = [];
      if (typeof v?.height === "number") parts.push(`${v.height}${unit}`);
      if (typeof v?.length === "number") parts.push(`${v.length}${unit}`);
      if (typeof v?.width === "number") parts.push(`${v.width}${unit}`);
      return parts.length ? parts.join(" × ") : empty;
    }

    default:
      return String(value);
  }
}


function groupFieldsByStep(roleDef: RoleDef) {
  // Build step order from stepsMeta if provided
  const orderMap = new Map<string, number>();
  roleDef.stepsMeta?.forEach((s, i) => {
    orderMap.set(s.id, s.order ?? i + 1);
  });

  // Group fields by their `step` id (fallback "general")
  const groups = new Map<string, RoleField[]>();
  for (const f of roleDef.fields) {
    const stepId = f.step || "general";
    if (!groups.has(stepId)) groups.set(stepId, []);
    groups.get(stepId)!.push(f);
  }

  // Sort groups by step order, then by insertion
  const entries = Array.from(groups.entries()).sort((a, b) => {
    const ao = orderMap.get(a[0]) ?? Number.MAX_SAFE_INTEGER;
    const bo = orderMap.get(b[0]) ?? Number.MAX_SAFE_INTEGER;
    return ao - bo;
  });

  return entries; // [ [stepId, RoleField[]], ... ]
}

function getStepTitle(stepId: string, roleDef: RoleDef) {
  if (stepId === "general") return "Details";
  const meta = roleDef.stepsMeta?.find((m) => m.id === stepId);
  return meta?.title || stepId;
}

// ---------- Component ----------
function JobAppFieldsBase({
  item,
  title,
  showStepHeadings = true,
  twoColumn = true,
  emptyPlaceholder = "—",
  hideFields,
}: JobAppFieldsProps) {
  
  const { appliedRole, applicationData } = item;

  const isHiddenByProp = (f: RoleField) => {
    const key = resolveFieldKey(f);
    if (Array.isArray(hideFields)) return hideFields.includes(key);
    if (typeof hideFields === "function") return !!hideFields(f, key);
    return false;
  };
  const roleDef = useMemo<RoleDef | undefined>(
    () => RolesTable.find((r) => r.name === appliedRole),
    [appliedRole]
  );

  const grouped = useMemo(() => {
    if (!roleDef) return [];
    return groupFieldsByStep(roleDef);
  }, [roleDef]);

  if (!roleDef) {
    return (
      <Box borderWidth="1px" borderRadius="md" p={4}>
        <Heading as="h3" size="sm" mb={2}>
          {title ?? "Role Details"}
        </Heading>
        <Text color="gray.500">No role configuration found for “{appliedRole}”.</Text>
      </Box>
    );
  }

  return (
    <Stack gap={4}>
      {title ? (
        <Heading as="h3" size="sm">
          {title}
        </Heading>
      ) : null}

      {grouped.map(([stepId, fields], gi) => (
        <Box key={stepId} borderWidth="1px" borderRadius="md" p={4}>
          {showStepHeadings ? (
            <>
              <Heading as="h4" size="xs" mb={3} color="gray.700">
                {getStepTitle(stepId, roleDef)}
              </Heading>
              <Separator mb={3} />
            </>
          ) : null}

          {twoColumn ? (
            <SimpleGrid columns={{ base: 1, md: 2 }} columnGap={6} rowGap={2}>
              {fields.map((f) => {
                if (isHiddenByProp(f)) return null; 
                const key = resolveFieldKey(f);
                const raw = (applicationData as any)?.[key];
                const value = formatValue(f, raw, emptyPlaceholder);

                // If a field is explicitly hidden in the form layer via colSpan: { base: 0 },
                // we still render it if a value exists; otherwise skip to avoid clutter.
                const isHidden = f.colSpan && typeof f.colSpan.base === "number" && f.colSpan.base === 0;
                if (isHidden && (raw == null || raw === "")) return null;

                return (
                  <Box key={key} py={1}>
                    <Text fontSize="sm" color="gray.600">
                      {f.label}
                    </Text>
                    <Text fontWeight="medium">{value}</Text>
                  </Box>
                );
              })}
            </SimpleGrid>
          ) : (
            <Stack gap={2}>
              {fields.map((f) => {
                const key = resolveFieldKey(f);
                const raw = (applicationData as any)?.[key];
                const value = formatValue(f, raw, emptyPlaceholder);

                const isHidden = f.colSpan && typeof f.colSpan.base === "number" && f.colSpan.base === 0;
                if (isHidden && (raw == null || raw === "")) return null;

                return (
                  <Box key={key} py={1}>
                    <Text fontSize="sm" color="gray.600">
                      {f.label}
                    </Text>
                    <Text fontWeight="medium">{value}</Text>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Box>
      ))}
    </Stack>
  );
  
}


export const JobAppFields = memo(JobAppFieldsBase);
export default JobAppFields;
