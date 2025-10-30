import { z } from "zod";

export const ShiftEnum = z.enum(["morning", "afternoon", "evening", "night"]);
export type ShiftEnum = z.infer<typeof ShiftEnum>;

export const IsoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
export type IsoDateString = z.infer<typeof IsoDateString>;

const SHIFTS: ShiftEnum[] = [
  "morning",
  "afternoon",
  "evening",
  "night",
] as const;
export function isValidShift(s?: string | null): s is ShiftEnum {
  return !!s && (SHIFTS as readonly string[]).includes(s);
}
