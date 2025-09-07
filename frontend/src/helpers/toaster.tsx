import { toaster } from "@/components/ui/toaster";

type UndoFn = () => void;

const withUndo = (undo?: UndoFn) =>
  undo ? { action: { label: "Undo", onClick: undo } } : undefined;

const base = {
  duration: 4000,
} as const;

export const toastMaxTwo = () =>
  toaster.create({
    ...base,
    type: "warning",
    title: "Only 2 shifts per day",
    description: "Turn one off first to add another.",
  });

export const toastTemplateMissing = (what: "weekends" | "template") =>
  toaster.create({
    ...base,
    type: "warning",
    title:
      what === "weekends"
        ? "Template required for weekends"
        : "Template not set",
    description:
      what === "weekends"
        ? "Set a weekly template to fill weekends."
        : "Define a weekly template first.",
  });

export const toastAppliedTemplate = (undo?: UndoFn) =>
  toaster.create({
    ...base,
    title: "Applied weekly template",
    description: undo ? "Undo changes?" : undefined,
    duration: 6000,
    ...withUndo(undo),
  });

export const toastClearedMonth = (undo?: UndoFn) =>
  toaster.create({
    ...base,
    title: "Cleared month",
    description: undo ? "Undo changes?" : undefined,
    duration: 6000,
    ...withUndo(undo),
  });

export const toastWeekends = (checked: boolean, undo?: UndoFn) =>
  toaster.create({
    ...base,
    title: checked ? "Checked weekends" : "Unchecked weekends",
    description: undo ? "Undo changes?" : undefined,
    duration: 6000,
    ...withUndo(undo),
  });

export const toastAppliedSameWeekday = (weekdayLong: string, undo?: UndoFn) =>
  toaster.create({
    ...base,
    title: `Applied to all ${weekdayLong}s`,
    description: undo ? "Undo changes?" : undefined,
    duration: 6000,
    ...withUndo(undo),
  });

export const toastRepeatedToEnd = (undo?: UndoFn) =>
  toaster.create({
    ...base,
    title: "Repeated to end of month",
    description: undo ? "Undo changes?" : undefined,
    duration: 6000,
    ...withUndo(undo),
  });

export const toastCopied = () =>
  toaster.create({
    ...base,
    type: "info",
    title: "Copied day pattern",
  });

export const toastNothingToPaste = () =>
  toaster.create({
    ...base,
    type: "warning",
    title: "Nothing to paste",
    description: "Copy a day first.",
  });

export const toastPasted = () =>
  toaster.create({
    ...base,
    type: "success",
    title: "Pasted to this day",
  });

export const toastDayCleared = (undo?: UndoFn) =>
  toaster.create({
    ...base,
    title: "Cleared day",
    duration: 6000,
    ...withUndo(undo),
  });

export const toastSetTwo = () =>
  toaster.create({
    ...base,
    type: "success",
    title: "Set Morning + Afternoon",
  });

export const toastOutsideDayInfo = () =>
  toaster.create({
    ...base,
    type: "info",
    title: "That day isn’t in this month",
    description: "Switch months or enable adjacent day editing.",
  });

export const toastLoginRequired = () =>
  toaster.create({
    ...base,
    type: "warning",
    title: "Please log in",
    description: "You must be logged in to apply for a role.",
  });

export const toastApplied = (roleName: string) =>
  toaster.create({
    ...base,
    type: "success",
    title: `Application started`,
    description: `Redirecting to ${roleName} application form...`,
  });

export function useScheduleToasts() {
  return {
    maxTwo: toastMaxTwo,
    templateMissing: toastTemplateMissing,
    appliedTemplate: toastAppliedTemplate,
    clearedMonth: toastClearedMonth,
    weekends: toastWeekends,
    appliedSameWeekday: toastAppliedSameWeekday,
    repeatedToEnd: toastRepeatedToEnd,
    copied: toastCopied,
    nothingToPaste: toastNothingToPaste,
    pasted: toastPasted,
    dayCleared: toastDayCleared,
    setTwo: toastSetTwo,
    outsideDay: toastOutsideDayInfo,
    loginRequired: toastLoginRequired,
    applied: toastApplied,
  };
}
