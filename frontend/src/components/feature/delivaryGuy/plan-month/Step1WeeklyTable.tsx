import { VStack, Text, Table, Box, Grid, HStack } from "@chakra-ui/react";
import {
  SHIFTS,
  daysShort,
  SHIFT_STATE,
  getShiftState,
  setShiftState,
  countPicked,
} from "@/store/scheduleStore";
import TriCell from "./TriCell";

/** Step 1: weekly pattern matrix (shifts × 7 days), responsive & no horizontal scroll on mobile. */
export default function Step1WeeklyTable({
  pattern,
  setPattern,
}: {
  pattern: number[];
  setPattern: (next: number[]) => void;
}) {
  // single-letter weekday labels for mobile
  const dayLetters = daysShort.map((d) => d[0]);

  return (
    <VStack align="stretch" gap={{ base: 3, md: 4 }}>
      {/* Responsive tip (keeps it tidy on phones) */}
      <Text fontSize={{ base: "xs", md: "sm" }} color="gray.600">
        Tip: each weekday can have at most <b>2 picks</b> (On + Standby) across
        all shifts.
      </Text>

      {/* -------------------- MOBILE (base…md-) -------------------- */}
      <Box display={{ base: "block", md: "none" }}>
        {/* Global day header (S M T W T F S) */}
        <Grid templateColumns="repeat(7, 1fr)" gap={1} px={1}>
          {dayLetters.map((l, i) => (
            <Box
              key={`${l}-${i}`}
              textAlign="center"
              fontSize="xs"
              color="gray.600"
            >
              {l}
            </Box>
          ))}
        </Grid>

        {/* One stacked card per shift */}
        <VStack align="stretch" gap={2} mt={2}>
          {SHIFTS.map((s, si) => (
            <Box
              key={s.name}
              border="1px"
              borderColor="gray.200"
              rounded="md"
              p={2}
              bg="white"
            >
              {/* shift header */}
              <HStack justify="space-between">
                <Text fontWeight="semibold" fontSize="sm">
                  {s.name}
                </Text>
                <Text fontSize="xs" color="gray.600">
                  {s.start} - {s.end}
                </Text>
              </HStack>

              {/* 7-day picker row */}
              <Grid templateColumns="repeat(7, 1fr)" gap={1} mt={2}>
                {Array.from({ length: 7 }, (_, dow) => {
                  const curMask = pattern[dow] ?? 0;
                  const cur = getShiftState(curMask, si);
                  const pickedCount = countPicked(curMask);

                  return (
                    <Box
                      key={`${si}-${dow}`}
                      display="flex"
                      justifyContent="center"
                    >
                      {/* scale TriCell down a bit so all 7 fit comfortably */}
                      <Box transform="scale(0.85)" transformOrigin="center">
                        <TriCell
                          value={cur}
                          onChange={(next) => {
                            // enforce max 2 picks for that weekday
                            const wasPicked = cur !== SHIFT_STATE.OFF;
                            const willPicked = next !== SHIFT_STATE.OFF;
                            const delta =
                              (willPicked ? 1 : 0) - (wasPicked ? 1 : 0);
                            if (pickedCount + delta > 2) return;

                            const nextMask = setShiftState(curMask, si, next);
                            const copy = [...pattern];
                            copy[dow] = nextMask;
                            setPattern(copy);
                          }}
                        />
                      </Box>
                    </Box>
                  );
                })}
              </Grid>
            </Box>
          ))}
        </VStack>
      </Box>

      {/* -------------------- DESKTOP/TABLET (md+) -------------------- */}
      <Box display={{ base: "none", md: "block" }}>
        <Table.Root size="sm" variant="line">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Shift / Day</Table.ColumnHeader>
              {daysShort.map((d) => (
                <Table.ColumnHeader key={d} textAlign="center">
                  {d}
                </Table.ColumnHeader>
              ))}
            </Table.Row>
          </Table.Header>

          <Table.Body>
            {SHIFTS.map((s, si) => (
              <Table.Row
                key={s.name}
                _last={{
                  "& > td, & > th": { borderBottomWidth: 0 }, // kill bottom border
                }}
              >
                <Table.Cell>
                  <VStack align="start" gap={0}>
                    <Text fontWeight="semibold">{s.name}</Text>
                    <Text fontSize="sm" color="gray.600">
                      {s.start} - {s.end}
                    </Text>
                  </VStack>
                </Table.Cell>

                {Array.from({ length: 7 }, (_, dow) => {
                  const curMask = pattern[dow] ?? 0;
                  const cur = getShiftState(curMask, si);
                  const pickedCount = countPicked(curMask);

                  return (
                    <Table.Cell key={`${si}-${dow}`} textAlign="center">
                      <TriCell
                        value={cur}
                        onChange={(next) => {
                          const wasPicked = cur !== SHIFT_STATE.OFF;
                          const willPicked = next !== SHIFT_STATE.OFF;
                          const delta =
                            (willPicked ? 1 : 0) - (wasPicked ? 1 : 0);
                          if (pickedCount + delta > 2) return;

                          const nextMask = setShiftState(curMask, si, next);
                          const copy = [...pattern];
                          copy[dow] = nextMask;
                          setPattern(copy);
                        }}
                      />
                    </Table.Cell>
                  );
                })}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Box>
    </VStack>
  );
}
