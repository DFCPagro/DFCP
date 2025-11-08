// src/store/timeframes.ts
export type SlotKey = "morning" | "afternoon" | "night";

export type TimeFrame = {
  key: SlotKey;
  label: string;
  // 24h clock in Asia/Jerusalem
  startHour: number; // inclusive
  endHour: number;   // exclusive
  windowLabel: string;
};

export const TIME_FRAMES: Readonly<TimeFrame[]> = [
  { key: "morning",   label: "Morning",   startHour: 6,  endHour: 12, windowLabel: "06:00–12:00" },
  { key: "afternoon", label: "Afternoon", startHour: 12, endHour: 16, windowLabel: "12:00–16:00" },
  { key: "night",     label: "Night",     startHour: 16, endHour: 22, windowLabel: "16:00–22:00" },
] as const;

/**
 * Returns an absolute date string like "2025-11-09" in Asia/Jerusalem.
 */
export function todayIL(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date()); // YYYY-MM-DD
}

function getILHour(): number {
  const parts = new Intl.DateTimeFormat("en-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    hour12: false,
  })
    .formatToParts(new Date())
    .find(p => p.type === "hour");
  return parts ? Number(parts.value) : new Date().getHours();
}

/**
 * Decide if an order placed *now* for the given slot arrives today or tomorrow.
 * Rule: if now < slot.endHour → today, else → tomorrow.
 * You can adjust to “now must be < slot.startHour” if you prefer a stricter cut-off.
 */
export function arrivalDayFor(slot: TimeFrame): "today" | "tomorrow" {
  const hour = getILHour();
  return hour < slot.endHour ? "today" : "tomorrow";
}

/**
 * Human label like: "Order now → Morning (06:00–12:00): arrives today"
 */
export function describeArrival(slot: TimeFrame): string {
  const day = arrivalDayFor(slot);
  return `${slot.label} (${slot.windowLabel}): arrives ${day}`;
}
