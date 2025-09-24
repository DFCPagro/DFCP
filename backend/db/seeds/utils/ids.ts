import mongoose from "mongoose";

/** A simple mapping of original identifiers to generated ones per seeder. */
export class IDMap {
  private storage: Record<string, Map<string, any>> = {};

  /** Record a mapping for a given seeder name. */
  set(seeder: string, original: string, generated: any): void {
    const key = seeder.toLowerCase();
    if (!this.storage[key]) this.storage[key] = new Map();
    this.storage[key].set(original, generated);
  }

  /** Look up a generated id given a seeder name and the original id. */
  get(seeder: string, original: string): any | undefined {
    const key = seeder.toLowerCase();
    return this.storage[key]?.get(original);
  }
}

/** Ensure a value is a Mongoose ObjectId.  Strings of length 24 are
 * converted; other types are returned unchanged. */
export function ensureObjectId(value: any): any {
  if (value == null) return value;
  if (mongoose.isValidObjectId(value)) return new mongoose.Types.ObjectId(value);
  return value;
}

/** Resolve a foreign key.  If the value is an original id (e.g. from a
 * referenced seeder) the generated id stored in the IDMap is returned.
 * Otherwise the input value is returned unchanged. */
export function resolveForeign(seeder: string, value: any, idMap: IDMap): any {
  if (typeof value === "string") {
    const mapped = idMap.get(seeder, value);
    return mapped ?? value;
  }
  return value;
}