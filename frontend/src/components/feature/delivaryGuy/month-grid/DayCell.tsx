import { Badge, Box, HStack, useBreakpointValue } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { Pencil } from "lucide-react";
import { SHIFTS, SHIFT_STATE, getShiftState, countPicked } from "@/store/scheduleStore";
import type { Density } from "./types";
import { StyledIconButton } from "@/components/ui/IconButton";

const ACTIVE_COLOR = "green" as const;

type Props = {
  date: Date;
  isToday: boolean;
  isOutside: boolean;
  isWeekend: boolean;
  mask: number;
  inThisMonth: boolean;
  editable: boolean;
  density: Density;
  weekendShade: boolean;
  showOutside: boolean;
  pad: number;
  dateFs: "xs" | "sm" | "md";
  onQuickClear: () => void;
  onQuickSetTwo: () => void;
  onOpenDrawer?: () => void;
  onCycle: (shiftIdx: number) => void;
};

export function DayCell({
  date,
  isToday,
  isOutside,
  isWeekend,
  mask,
  inThisMonth,
  editable,
  density,
  weekendShade,
  showOutside,
  pad,
  dateFs,
  onOpenDrawer,
  onCycle,
}: Props) {
  const isMobile = useBreakpointValue({ base: true, md: false }) ?? false;
  const bgCell = weekendShade && isWeekend ? "gray.50" : "white";

  return (
    <Box
      position="relative"
      border="1px"
      borderColor={isToday ? "blue.300" : "gray.200"}
      rounded="lg"
      overflow="hidden"
      bg={bgCell}
      p={pad}
      aspectRatio={{ base: 0.7, md: 1 }}     // shorter on phones so 7×6 fits
      _hover={{ boxShadow: "sm" }}
      role="group"
      // tap anywhere to edit on phones (bigger touch target)
      onClick={
        isMobile && inThisMonth && editable
          ? (e) => {
              e.stopPropagation();
              onOpenDrawer?.();
            }
          : undefined
      }
      cursor={isMobile && inThisMonth && editable ? "pointer" : "default"}
    >
      {isToday && (
        <Box
          position="absolute"
          inset={0}
          pointerEvents="none"
          rounded="lg"
          boxShadow="0 0 0 2px var(--chakra-colors-blue-300) inset"
        />
      )}

      {/* header: date + (desktop-only) edit icon */}
      <HStack
        justify="space-between"
        align="start"
        mb={{ base: 1, md: 2 }}
        opacity={isOutside ? 0.6 : 1}
      >
        <Box fontSize={dateFs} color="gray.700" fontWeight="semibold">
          {date.getDate()}
        </Box>

        {editable && inThisMonth && (
          <Tooltip content="Edit day">
            <StyledIconButton
              aria-label="Edit day"
              size="xs"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDrawer?.();
              }}
              display={{ base: "none", md: "inline-flex" }} // hide on phones
            >
              <Pencil size={14} />
            </StyledIconButton>
          </Tooltip>
        )}
      </HStack>

      {/* body: compact dots or detailed chips */}
     <Box opacity={isOutside ? 0.6 : 1}>
  {density === "dots"
    ? (countPicked(mask) > 0 && inThisMonth ? <DotRow mask={mask} /> : null)
    : (
      <ChipRow
        mask={mask}
        editable={editable && inThisMonth}
        onCycle={onCycle}
      />
    )}
</Box>

      {isOutside && showOutside && (
        <Box
          position="absolute"
          inset={0}
          pointerEvents="auto"
          cursor="not-allowed"
          aria-hidden
        />
      )}
    </Box>
  );
}

function DotRow({ mask }: { mask: number }) {
  const dot = useBreakpointValue({ base: 1.5, md: 2.5 })!;
  const gap = useBreakpointValue({ base: 1, md: 2 })!;

  // keep only active shifts; show at most 2 (you cap picks at 2 anyway)
  const active = SHIFTS.map((s, si) => {
    const st = getShiftState(mask, si);
    return { s, st, isOn: st === SHIFT_STATE.ON, isS: st === SHIFT_STATE.STANDBY };
  }).filter(p => p.st !== SHIFT_STATE.OFF).slice(0, 2);

  if (active.length === 0) return null; // nothing → no space taken

  return (
    <HStack gap={gap}>
      {active.map((p) => (
        <Tooltip key={p.s.name} content={`${p.s.name} — ${p.isOn ? "On" : "Standby"}`}>
          <Box
            w={dot}
            h={dot}
            rounded="full"
            borderWidth="1px"
            {...(p.isOn
              ? { bg: `green.500`, borderColor: `green.500` }
              : { bg: "transparent", borderColor: `green.500`, borderStyle: "dashed" })}
          />
        </Tooltip>
      ))}
    </HStack>
  );
}


function ChipRow({
  mask,
  editable,
  onCycle,
}: {
  mask: number;
  editable: boolean;
  onCycle: (si: number) => void;
}) {
  return (
    <HStack gap={1} wrap="wrap">
      {SHIFTS.map((s, si) => {
        const st = getShiftState(mask, si);
        const isOn = st === SHIFT_STATE.ON;
        const isS = st === SHIFT_STATE.STANDBY;

        const badge = (
          <Badge
            variant={isOn ? "solid" : "outline"}
            colorPalette={isOn || isS ? ACTIVE_COLOR : "gray"}
            borderStyle={isS ? "dashed" : undefined}
            opacity={st === SHIFT_STATE.OFF ? 0.8 : 1}
            {...(editable
              ? {
                  as: "button",
                  type: "button",
                  onClick: () => onCycle(si),
                  "aria-pressed": st !== SHIFT_STATE.OFF,
                }
              : {})}
          >
            {s.name[0]}
            {isS ? "·S" : ""}
          </Badge>
        );

        return (
          <Tooltip
            key={s.name}
            content={`${s.name} — ${isOn ? "On" : isS ? "Standby" : "Off"}`}
          >
            {badge}
          </Tooltip>
        );
      })}
    </HStack>
  );
}
