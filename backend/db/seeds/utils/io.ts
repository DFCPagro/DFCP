import fs from "fs";
import { z } from "zod";

/**
 * Load a JSON file.  Supports two formats: a single JSON array of objects
 * (`[ {...}, {...}, ... ]`) or NDJSON (one JSON document per line).  If the
 * file does not exist an empty array is returned.  When the input is
 * malformed the function either throws (strict mode) or emits a warning
 * and returns an empty array.  A simple schema may be provided for
 * validation; when validation fails the same strict/warn behaviour
 * applies.
 */
export function loadJSON<T = any>(
  filePath: string,
  opts?: { strict?: boolean; schema?: z.ZodType<T> }
): T[] {
  const strict = opts?.strict ?? false;
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8");
  // Try to parse as normal JSON
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return validateList(parsed, opts?.schema, strict);
    }
  } catch (err) {
    // ignore – may be NDJSON
  }
  // Try NDJSON
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const docs: any[] = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      docs.push(obj);
    } catch (err) {
      if (strict) throw new Error(`Failed to parse NDJSON line: ${line}`);
      console.warn(`⚠️  Ignoring invalid NDJSON line in ${filePath}`);
    }
  }
  return validateList(docs, opts?.schema, strict);
}

function validateList<T>(list: any[], schema: z.ZodType<T> | undefined, strict: boolean): T[] {
  if (!schema) return list as T[];
  const result: T[] = [];
  for (const [idx, item] of list.entries()) {
    const parsed = schema.safeParse(item);
    if (parsed.success) {
      result.push(parsed.data);
    } else if (strict) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      throw new Error(`Validation failed at index ${idx}: ${issues}`);
    } else {
      console.warn(`⚠️  Skipping invalid entry at index ${idx}: ${parsed.error.message}`);
    }
  }
  return result;
}