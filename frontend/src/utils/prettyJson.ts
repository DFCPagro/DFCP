/**
 * Safely stringify an object into pretty JSON with 2-space indentation.
 * Falls back to a string message if serialization fails.
 */
export function prettyJson(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (err) {
    return `<< Unserializable object >>`;
  }
}
