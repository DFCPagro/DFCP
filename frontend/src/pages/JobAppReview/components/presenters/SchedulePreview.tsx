// src/pages/jobAppReview/components/presenters/SchedulePreview.tsx
import { memo, useMemo } from "react";
import { Box, Grid, GridItem, Stack, Text } from "@chakra-ui/react";
import {
  decodeWeekly,
  isValidWeeklyMask,
  SHIFTS,
  DAYS,
  type Row,
} from "@/utils/scheduleBitmap";

export type SchedulePreviewProps = {
  /** 7-length array of per-day bitmasks (0..15) */
  weeklyMask?: number[] | null;
  /** "grid" (default) shows a compact 7×4 matrix; "list" shows per-day text */
  variant?: "grid" | "list";
  /** If true, render smaller paddings/font sizes for dense tables */
  compact?: boolean;
  /** Optional title shown above the schedule */
  title?: string;
};

/**
 * Read-only weekly schedule preview.
 * - Uses utils/scheduleBitmap to decode bitmasks (stable: Morning=1, Afternoon=2, Evening=4, Night=8).
 * - Chakra UI v2-compatible primitives only (no slot/compound APIs).
 */
function SchedulePreviewBase({
  weeklyMask,
  variant = "grid",
  compact = true,
  title,
}: SchedulePreviewProps) {
  const rows: Row[] | null = useMemo(() => {
    if (!weeklyMask || !isValidWeeklyMask(weeklyMask)) return null;
    return decodeWeekly(weeklyMask);
  }, [weeklyMask]);

  if (!rows) {
    return (
      <Box borderWidth="1px" borderRadius="md" p={3}>
        {title ? (
          <Text mb={2} fontWeight="semibold">
            {title}
          </Text>
        ) : null}
        <Text color="gray.500" fontSize={compact ? "sm" : "md"}>
          No schedule provided
        </Text>
      </Box>
    );
  }

  if (variant === "list") {
    // "Sun: Morning, Evening • Mon: — ..."
    return (
      <Box borderWidth="1px" borderRadius="md" p={compact ? 3 : 4}>
        {title ? (
          <Text mb={2} fontWeight="semibold">
            {title}
          </Text>
        ) : null}
        <Stack gap={compact ? 1 : 2}>
          {DAYS.map((day, dIdx) => {
            const active = SHIFTS.filter((_, sIdx) => rows[sIdx][dIdx]);
            const line =
              active.length > 0 ? active.join(", ") : "—";
            return (
              <Text
                key={day}
                fontSize={compact ? "sm" : "md"}
                lineHeight={compact ? 1.25 : 1.5}
              >
                <Text as="span" fontWeight="medium">
                  {day}:
                </Text>{" "}
                {line}
              </Text>
            );
          })}
        </Stack>
      </Box>
    );
  }

  // Default: compact 7×4 grid (columns = days, rows = shifts)
  return (
    <Box borderWidth="1px" borderRadius="md" p={compact ? 3 : 4}>
      {title ? (
        <Text mb={2} fontWeight="semibold">
          {title}
        </Text>
      ) : null}

      {/* Column headers (days) */}
      <Grid
        templateColumns={`minmax(80px, 1fr) repeat(${DAYS.length}, minmax(40px, 1fr))`}
        gap={compact ? 1 : 2}
        alignItems="center"
      >
        <GridItem />
        {DAYS.map((d) => (
          <GridItem key={d}>
            <Text
              textAlign="center"
              fontSize={compact ? "xs" : "sm"}
              color="gray.600"
              fontWeight="medium"
            >
              {d}
            </Text>
          </GridItem>
        ))}

        {/* Shift rows */}
        {SHIFTS.map((shift, sIdx) => (
          <GridItem key={`row-${shift}`} colSpan={DAYS.length + 1} px={0}>
            <Grid
              templateColumns={`minmax(80px, 1fr) repeat(${DAYS.length}, minmax(40px, 1fr))`}
              gap={compact ? 1 : 2}
              alignItems="center"
            >
              {/* Shift label */}
              <GridItem>
                <Text
                  fontSize={compact ? "xs" : "sm"}
                  color="gray.700"
                  fontWeight="medium"
                >
                  {shift}
                </Text>
              </GridItem>

              {/* Day cells */}
              {DAYS.map((d, dIdx) => {
                const active = rows[sIdx][dIdx];
                return (
                  <GridItem key={`${shift}-${d}`}>
                    <Box
                      role="gridcell"
                      aria-checked={active}
                      borderWidth="1px"
                      borderRadius="sm"
                      height={compact ? "22px" : "28px"}
                      bg={active ? "green.50" : "transparent"}
                      borderColor={active ? "green.300" : "gray.200"}
                    />
                  </GridItem>
                );
              })}
            </Grid>
          </GridItem>
        ))}
      </Grid>
    </Box>
  );
}

export const SchedulePreview = memo(SchedulePreviewBase);
export default SchedulePreview;
