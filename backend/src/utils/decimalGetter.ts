// utils/decimalGetter.ts
import { Types } from "mongoose";

export function decToNumber(v?: Types.Decimal128 | null): number | null {
  if (v == null) return null; // or return 0 if you prefer non-null
  return Number(v.toString());
}
