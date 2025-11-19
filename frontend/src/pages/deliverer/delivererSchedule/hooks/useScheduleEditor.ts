// src/pages/deliverer/schedule/hooks/useScheduleEditor.ts

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ShiftName } from "@/api/shifts";
import {
  createMonthlySchedule,
  updateMonthlySchedule,
  type MonthString,
  type ScheduleBitmap,
  type ScheduleType,
} from "@/api/schedule";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export type ShiftMode = "none" | "active" | "standby";

export type UseScheduleEditorArgs = {
  /** Month key in "YYYY-MM" format, must match what `getMySchedule` uses. */
  month: MonthString;
  /** Active bitmap for that month (from `useDelivererSchedule`). */
  activeBitmap: ScheduleBitmap;
  /** Standby bitmap for that month (from `useDelivererSchedule`). */
  standByBitmap: ScheduleBitmap;
  /**
   * Optional callback invoked after a successful save and query invalidation.
   * Use this if you want to show toasts or do extra work in the page.
   */
  onSaved?: () => void;
};

export type UseScheduleEditorResult = {
  /** Same month key passed in args, for convenience. */
  month: MonthString;
  /** Number of days in this month (used by grids / editors). */
  daysInMonth: number;

  /** Current editable active bitmap (normalized to `daysInMonth`). */
  activeDraft: ScheduleBitmap;
  /** Current editable standby bitmap (normalized to `daysInMonth`). */
  standByDraft: ScheduleBitmap;

  /**
   * Get the current mode (none/active/standby) for a specific day+shift.
   * `day` is 1-based (1 = first day of month).
   */
  getShiftMode: (day: number, shift: ShiftName) => ShiftMode;

  /**
   * Explicitly set mode for a specific day+shift.
   * `day` is 1-based (1 = first day of month).
   *
   * Enforces mutual exclusivity:
   * - "active" → clears standby bit for that shift
   * - "standby" → clears active bit for that shift
   * - "none" → clears both
   */
  setShiftMode: (day: number, shift: ShiftName, mode: ShiftMode) => void;

  /**
   * Convenience helper: cycles mode in the order
   * none → active → standby → none.
   */
  toggleShiftMode: (day: number, shift: ShiftName) => void;

  /** True if either active or standby bitmap differs from original. */
  hasChanges: boolean;

  /** Save in progress flag (covers both active + standby saves). */
  isSaving: boolean;
  /** Last error from save, if any. */
  error: unknown;

  /** Reset edits back to original bitmap values from the server. */
  reset: () => void;

  /**
   * Persist changes to backend using POST/PATCH:
   * - If a scheduleType has no existing month → POST /schedule/month
   * - If it has an existing month              → PATCH /schedule/month
   *
   * Skips network calls when there are no changes.
   */
  save: () => Promise<void>;
};

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

/** Bit flags per shift (must match backend bitmap representation). */
const SHIFT_BITS: Record<ShiftName, number> = {
  morning: 0b0001,
  afternoon: 0b0010,
  evening: 0b0100,
  night: 0b1000,
  none: 0b0000,
};

/** Safely get bit for a shift; returns 0 for unknown values. */
function getShiftBit(shift: ShiftName): number {
  return SHIFT_BITS[shift] ?? 0;
}

/** Days in a given "YYYY-MM" month. */
function getDaysInMonth(month: MonthString): number {
  const [yStr, mStr] = month.split("-");
  const year = Number(yStr);
  const monthNum = Number(mStr); // 1–12

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(monthNum) ||
    monthNum < 1 ||
    monthNum > 12
  ) {
    // Fallback; better than crashing the UI
    return 31;
  }

  // JS Date month is 0–11; day=0 gives last day of previous month.
  // Example: monthNum=11 (November) → new Date(year, 11, 0) ⇒ last day of November.
  return new Date(year, monthNum, 0).getDate();
}

/**
 * Normalize incoming bitmaps to a fixed length (=daysInMonth) and enforce
 * the "no overlap per shift between active and standby" invariant:
 * any bits present in both are cleared from standby.
 */
function normalizeBitmaps(
  active: ScheduleBitmap | undefined,
  standBy: ScheduleBitmap | undefined,
  daysInMonth: number
): { active: ScheduleBitmap; standBy: ScheduleBitmap } {
  const a: ScheduleBitmap = Array.from(
    { length: daysInMonth },
    (_, idx) => active?.[idx] ?? 0
  );
  const s: ScheduleBitmap = Array.from(
    { length: daysInMonth },
    (_, idx) => standBy?.[idx] ?? 0
  );

  for (let i = 0; i < daysInMonth; i++) {
    const conflictMask = a[i] & s[i];
    if (conflictMask) {
      // Active wins; remove overlapping bits from standby.
      s[i] = s[i] & ~conflictMask;
    }
  }

  return { active: a, standBy: s };
}

/** True if there is at least one non-zero entry in bitmap. */
function hasAnyBits(bitmap: ScheduleBitmap): boolean {
  return bitmap.some((v) => v > 0);
}

/** Deep equality for two bitmaps (same length & all values equal). */
function bitmapsEqual(a: ScheduleBitmap, b: ScheduleBitmap): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Decide whether, for a given scheduleType, we should use POST or PATCH.
 *
 * - When the original bitmap had any non-zero bits → treat as existing month → PATCH.
 * - When the original was entirely zeros array     → treat as no month yet → POST.
 *
 * Edge case: a truly existing month with only zeros will be treated as "no month"
 * and hit POST; backend will respond with 409 in that case, which is acceptable.
 */
function chooseVerbForType(
  scheduleType: ScheduleType,
  original: ScheduleBitmap
): "create" | "update" {
  return hasAnyBits(original) ? "update" : "create";
}

/* -------------------------------------------------------------------------- */
/*                            Internal save helper                            */
/* -------------------------------------------------------------------------- */

async function saveBitmapForType(
  scheduleType: ScheduleType,
  month: MonthString,
  original: ScheduleBitmap,
  draft: ScheduleBitmap
) {
  const verb = chooseVerbForType(scheduleType, original);

  if (verb === "update") {
    return updateMonthlySchedule({
      month,
      scheduleType,
      bitmap: draft,
    });
  }

  // "create" branch – non-managers can only create their own schedule
  return createMonthlySchedule({
    month,
    scheduleType,
    bitmap: draft,
  });
}

/* -------------------------------------------------------------------------- */
/*                              useScheduleEditor                             */
/* -------------------------------------------------------------------------- */

type SaveVariables = {
  month: MonthString;
  originalActive: ScheduleBitmap;
  originalStandBy: ScheduleBitmap;
  draftActive: ScheduleBitmap;
  draftStandBy: ScheduleBitmap;
};

export function useScheduleEditor(
  args: UseScheduleEditorArgs
): UseScheduleEditorResult {
  const { month, activeBitmap, standByBitmap, onSaved } = args;

  const daysInMonth = useMemo(() => getDaysInMonth(month), [month]);

  const makeNormalized = useCallback(
    () => normalizeBitmaps(activeBitmap, standByBitmap, daysInMonth),
    [activeBitmap, standByBitmap, daysInMonth]
  );

  // Original values from server (normalized, stable baseline for diff).
  const [original, setOriginal] = useState(() => makeNormalized());

  // Editable draft bitmaps.
  const [activeDraft, setActiveDraft] = useState<ScheduleBitmap>(
    () => original.active
  );
  const [standByDraft, setStandByDraft] = useState<ScheduleBitmap>(
    () => original.standBy
  );

  // Keep internal state in sync when backend data changes (e.g., refetch after save).
  useEffect(() => {
    const normalized = makeNormalized();
    setOriginal(normalized);
    setActiveDraft(normalized.active);
    setStandByDraft(normalized.standBy);
  }, [makeNormalized]);

  const queryClient = useQueryClient();

  const hasChanges = useMemo(() => {
    return (
      !bitmapsEqual(original.active, activeDraft) ||
      !bitmapsEqual(original.standBy, standByDraft)
    );
  }, [original, activeDraft, standByDraft]);

  const getShiftMode = useCallback(
    (day: number, shift: ShiftName): ShiftMode => {
      const idx = day - 1; // day is 1-based
      if (idx < 0 || idx >= daysInMonth) return "none";

      const bit = getShiftBit(shift);
      if (!bit) return "none";

      const activeVal = activeDraft[idx] ?? 0;
      const standByVal = standByDraft[idx] ?? 0;

      const activeOn = (activeVal & bit) !== 0;
      const standbyOn = (standByVal & bit) !== 0;

      if (activeOn && !standbyOn) return "active";
      if (!activeOn && standbyOn) return "standby";

      // If both are on (shouldn't happen after normalization), prefer "active".
      if (activeOn && standbyOn) return "active";

      return "none";
    },
    [activeDraft, standByDraft, daysInMonth]
  );

  const setShiftMode = useCallback(
    (day: number, shift: ShiftName, mode: ShiftMode) => {
      const idx = day - 1; // day is 1-based
      if (idx < 0 || idx >= daysInMonth) return;

      const bit = getShiftBit(shift);
      if (!bit) return;

      // Active bitmap update
      setActiveDraft((prev) => {
        const next = [...prev];
        const current = next[idx] ?? 0;
        let updated = current;

        if (mode === "active") {
          updated = current | bit; // set bit
        } else {
          // mode === "standby" or "none" → clear bit
          updated = current & ~bit;
        }

        next[idx] = updated;
        return next;
      });

      // Standby bitmap update
      setStandByDraft((prev) => {
        const next = [...prev];
        const current = next[idx] ?? 0;
        let updated = current;

        if (mode === "standby") {
          updated = current | bit; // set bit
        } else {
          // mode === "active" or "none" → clear bit
          updated = current & ~bit;
        }

        next[idx] = updated;
        return next;
      });
    },
    [daysInMonth]
  );

  const toggleShiftMode = useCallback(
    (day: number, shift: ShiftName) => {
      const current = getShiftMode(day, shift);
      const next: ShiftMode =
        current === "none"
          ? "active"
          : current === "active"
            ? "standby"
            : "none";
      setShiftMode(day, shift, next);
    },
    [getShiftMode, setShiftMode]
  );

  const reset = useCallback(() => {
    setActiveDraft([...original.active]);
    setStandByDraft([...original.standBy]);
  }, [original]);

  const mutation = useMutation<unknown, unknown, SaveVariables>({
    mutationFn: async (vars: SaveVariables) => {
      const {
        month: monthKey,
        originalActive,
        originalStandBy,
        draftActive,
        draftStandBy,
      } = vars;

      const tasks: Promise<unknown>[] = [];

      const activeChanged = !bitmapsEqual(originalActive, draftActive);
      const standbyChanged = !bitmapsEqual(originalStandBy, draftStandBy);

      if (!activeChanged && !standbyChanged) {
        return [];
      }

      if (activeChanged) {
        tasks.push(
          saveBitmapForType("active", monthKey, originalActive, draftActive)
        );
      }

      if (standbyChanged) {
        tasks.push(
          saveBitmapForType("standby", monthKey, originalStandBy, draftStandBy)
        );
      }

      if (tasks.length === 0) return [];

      const results = await Promise.all(tasks);
      return results;
    },
    onSuccess: async (_data, vars) => {
      // Update our "original" baseline to reflect the just-saved state.
      setOriginal({
        active: [...vars.draftActive],
        standBy: [...vars.draftStandBy],
      });

      // Invalidate the monthly schedule query so `useDelivererSchedule` refetches.
      await queryClient.invalidateQueries({
        queryKey: ["schedule", "my", vars.month],
      });

      if (onSaved) onSaved();
    },
  });

  const save = useCallback(async () => {
    const vars: SaveVariables = {
      month,
      originalActive: original.active,
      originalStandBy: original.standBy,
      draftActive: activeDraft,
      draftStandBy: standByDraft,
    };

    // Early exit to avoid hitting the network when nothing changed.
    const activeChanged = !bitmapsEqual(vars.originalActive, vars.draftActive);
    const standbyChanged = !bitmapsEqual(
      vars.originalStandBy,
      vars.draftStandBy
    );
    if (!activeChanged && !standbyChanged) {
      return;
    }

    await mutation.mutateAsync(vars);
  }, [month, original, activeDraft, standByDraft, mutation]);

  return {
    month,
    daysInMonth,
    activeDraft,
    standByDraft,
    getShiftMode,
    setShiftMode,
    toggleShiftMode,
    hasChanges,
    isSaving: mutation.isPending,
    error: mutation.error,
    reset,
    save,
  };
}
