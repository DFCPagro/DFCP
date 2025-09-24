import fg from "fast-glob";

/**
 * Parse a list of names, globs or the special values `all` and `*` into
 * a canonical array.  The input may be a comma/semicolon separated string
 * or an array of strings.  All values are trimmed and lower‑cased.
 */
export function parseList(input?: string | string[]): string[] {
  if (!input) return [];
  const arr: string[] = [];
  const pieces = Array.isArray(input) ? input : [input];
  for (const piece of pieces) {
    if (typeof piece !== "string") continue;
    piece
      .split(/[;,\s]+/g)
      .map((p) => p.trim())
      .filter(Boolean)
      .forEach((p) => arr.push(p.toLowerCase()));
  }
  return arr;
}

/**
 * Parse key/value pairs from a string.  Pairs are separated by commas or
 * semicolons.  Each pair is of the form `name=value` where the value may
 * be a number or a comma separated list of strings.  The special name
 * `*` may be used as a catch‑all.  All keys are returned in lower case.
 *
 * When `asList` is true the values are returned as arrays of strings;
 * otherwise they are coerced to numbers.  If no input is provided an
 * empty object is returned.
 */
export function parsePairs(input: string | undefined, asList: boolean): Record<string, any> {
  const result: Record<string, any> = {};
  if (!input) return result;
  const segments = input.split(/[;,]+/g).map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const [keyRaw, valueRaw] = seg.split(/=/);
    const key = (keyRaw || "").toLowerCase();
    const valuePart = valueRaw ?? "";
    if (!key) continue;
    if (asList) {
      const vals = valuePart
        .split(/[,\s]+/g)
        .map((v) => v.trim())
        .filter(Boolean);
      result[key] = vals;
    } else {
      const n = Number(valuePart);
      result[key] = Number.isFinite(n) ? n : 0;
    }
  }
  return result;
}

/**
 * Expand an array of glob patterns into a set of absolute file paths.  The
 * globbing is performed synchronously via `fast-glob`.  If no input is
 * provided an empty array is returned.  Duplicate results are removed.
 */
export function expandGlobs(patterns?: string | string[]): string[] {
  if (!patterns) return [];
  const globs = Array.isArray(patterns) ? patterns : [patterns];
  const files = fg.sync(globs, { dot: false, absolute: true, unique: true });
  return Array.from(new Set(files));
}