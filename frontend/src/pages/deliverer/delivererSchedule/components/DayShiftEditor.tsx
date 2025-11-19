// src/pages/deliverer/schedule/components/DayShiftEditor.tsx

import * as React from "react";
import {
    Box,
    Button,
    ButtonGroup,
    Drawer,
    HStack,
    Portal,
    Separator,
    Stack,
    Text,
    useDisclosure,
} from "@chakra-ui/react";
import { toaster } from "@/components/ui/toaster";
import type { ShiftName } from "@/api/shifts";
import type { ShiftMode } from "../hooks/useScheduleEditor";

/** Local list in display order */
const SHIFTS: ShiftName[] = ["morning", "afternoon", "evening", "night"];

const LABEL: Record<ShiftName, { short: string; full: string }> = {
    morning: { short: "M", full: "Morning" },
    afternoon: { short: "A", full: "Afternoon" },
    evening: { short: "E", full: "Evening" },
    night: { short: "N", full: "Night" },
    none: { short: "-", full: "No Shift" },
};

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export type DayShiftEditorProps = {
    /** Controls open/close of the drawer */
    isOpen: boolean;
    onClose: () => void;

    /** 1-based day number inside the month */
    day: number;
    /** Numeric month 1–12 and full year for title */
    month: number;
    year: number;

    /** Hook adapters from useScheduleEditor */
    getShiftMode: (day: number, shift: ShiftName) => ShiftMode;
    setShiftMode: (day: number, shift: ShiftName, mode: ShiftMode) => void;
    toggleShiftMode?: (day: number, shift: ShiftName) => void;

    /** Global save/reset from the editor hook (persists the whole month) */
    hasChanges: boolean;
    isSaving: boolean;
    error?: unknown;
    onSave: () => Promise<void>;
    onReset: () => void;
};

/* -------------------------------------------------------------------------- */
/*                                Subcomponents                               */
/* -------------------------------------------------------------------------- */

function ModePill({
    mode,
    isActive,
    onClick,
}: {
    mode: ShiftMode;
    isActive: boolean;
    onClick: () => void;
}) {
    const label =
        mode === "active" ? "Active" : mode === "standby" ? "Standby" : "None";
    const variant = isActive ? "solid" : "outline";
    const colorPalette =
        mode === "active" ? "green" : mode === "standby" ? "yellow" : "gray";
    return (
        <Button size="sm" variant={variant} colorPalette={colorPalette} onClick={onClick}>
            {label}
        </Button>
    );
}

function Row({
    day,
    shift,
    getShiftMode,
    setShiftMode,
}: {
    day: number;
    shift: ShiftName;
    getShiftMode: DayShiftEditorProps["getShiftMode"];
    setShiftMode: DayShiftEditorProps["setShiftMode"];
}) {
    const current = getShiftMode(day, shift);
    return (
        <HStack justify="space-between" align="center">
            <HStack gap="3">
                <Box
                    w="6"
                    h="6"
                    borderRadius="full"
                    bg={current === "active" ? "green.400" : current === "standby" ? "yellow.400" : "gray.300"}
                    borderWidth="1px"
                    borderColor="blackAlpha.300"
                    _dark={{ borderColor: "whiteAlpha.300" }}
                    aria-hidden
                />
                <Text fontWeight="medium">
                    {LABEL[shift].full} <Text as="span" color="fg.subtle">({LABEL[shift].short})</Text>
                </Text>
            </HStack>
            <ButtonGroup size="sm" attached>
                <ModePill
                    mode="none"
                    isActive={current === "none"}
                    onClick={() => setShiftMode(day, shift, "none")}
                />
                <ModePill
                    mode="active"
                    isActive={current === "active"}
                    onClick={() => setShiftMode(day, shift, "active")}
                />
                <ModePill
                    mode="standby"
                    isActive={current === "standby"}
                    onClick={() => setShiftMode(day, shift, "standby")}
                />
            </ButtonGroup>
        </HStack>
    );
}

/* -------------------------------------------------------------------------- */
/*                                Main Component                              */
/* -------------------------------------------------------------------------- */

export default function DayShiftEditor({
    isOpen,
    onClose,
    day,
    month,
    year,
    getShiftMode,
    setShiftMode,
    toggleShiftMode, // optional, not required
    hasChanges,
    isSaving,
    error,
    onSave,
    onReset,
}: DayShiftEditorProps) {
    const { open: confirmResetOpen, onOpen: openConfirmReset, onClose: closeConfirmReset } =
        useDisclosure();

    const dateLabel = React.useMemo(() => {
        const d = new Date(year, month - 1, day);
        const fmt = new Intl.DateTimeFormat("en", {
            weekday: "short",
            month: "long",
            day: "2-digit",
            year: "numeric",
        });
        return fmt.format(d);
    }, [year, month, day]);

    const quickSetAll = (mode: ShiftMode) => {
        SHIFTS.forEach((s) => setShiftMode(day, s, mode));
    };

    const handleSave = async () => {
        try {
            await onSave();
            toaster.create({
                type: "success",
                title: "Schedule saved",
                description: `Saved changes for ${dateLabel}.`,
            });
            onClose();
        } catch (_e) {
            toaster.create({
                type: "error",
                title: "Could not save",
                description: "Please try again.",
            });
        }
    };

    const handleReset = () => {
        onReset();
        closeConfirmReset();
        toaster.create({
            type: "info",
            title: "Changes reset",
            description: `Reverted edits for ${dateLabel}.`,
        });
    };

    return (
        <Drawer.Root
            open={isOpen}
            onOpenChange={(e) => {
                if (!e.open) onClose();
            }}
            size="md"
        >
            <Portal>
                <Drawer.Backdrop />
                <Drawer.Positioner>
                    <Drawer.Content>
                        <Drawer.Header>
                            <Drawer.Title>
                                Edit Shifts — <Text as="span" color="fg.subtle">{dateLabel}</Text>
                            </Drawer.Title>
                        </Drawer.Header>

                        <Drawer.Body>
                            <Stack gap="4">
                                {/* Quick actions */}
                                <HStack gap="2" wrap="wrap">
                                    <Text fontWeight="medium">Quick set:</Text>
                                    <Button size="sm" onClick={() => quickSetAll("none")}>None</Button>
                                    <Button size="sm" colorPalette="green" onClick={() => quickSetAll("active")}>
                                        All Active
                                    </Button>
                                    <Button size="sm" colorPalette="yellow" onClick={() => quickSetAll("standby")}>
                                        All Standby
                                    </Button>
                                </HStack>

                                <Separator />

                                {/* Four shift rows */}
                                <Stack gap="3">
                                    {SHIFTS.map((shift) => (
                                        <Row
                                            key={shift}
                                            day={day}
                                            shift={shift}
                                            getShiftMode={getShiftMode}
                                            setShiftMode={setShiftMode}
                                        />
                                    ))}
                                </Stack>

                                {/* Optional hint */}
                                <Box color="fg.subtle" fontSize="sm">
                                    Active and Standby are mutually exclusive per shift.
                                    Setting a shift to <b>Active</b> clears Standby for that shift (and vice versa).
                                </Box>

                                {error ? (
                                    <Box color="red.500" fontSize="sm">
                                        {(error as any)?.message ?? "Failed to save. Backend rejected the change."}
                                    </Box>
                                ) : null}
                            </Stack>
                        </Drawer.Body>

                        <Drawer.Footer gap="2">
                            <Button variant="ghost" onClick={onClose} disabled={isSaving}>
                                Close
                            </Button>
                            <Button variant="ghost" onClick={openConfirmReset} disabled={!hasChanges || isSaving}>
                                Reset
                            </Button>
                            <Button colorPalette="blue" onClick={handleSave} loading={isSaving} disabled={!hasChanges}>
                                Save Changes
                            </Button>
                        </Drawer.Footer>
                    </Drawer.Content>
                </Drawer.Positioner>
            </Portal>

            {/* Lightweight confirm UI (inline) */}
            {confirmResetOpen && (
                <Box
                    position="fixed"
                    inset="0"
                    bg="blackAlpha.600"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    zIndex="toast"
                >
                    <Stack bg="bg.panel" borderWidth="1px" borderRadius="lg" p="4" minW="xs" gap="3">
                        <Text fontWeight="semibold">Reset changes?</Text>
                        <Text color="fg.subtle" fontSize="sm">
                            This will revert all edits for this day back to the last saved state.
                        </Text>
                        <HStack justify="flex-end">
                            <Button size="sm" onClick={closeConfirmReset} variant="ghost">
                                Cancel
                            </Button>
                            <Button size="sm" colorPalette="red" onClick={handleReset}>
                                Reset
                            </Button>
                        </HStack>
                    </Stack>
                </Box>
            )}
        </Drawer.Root>
    );
}
