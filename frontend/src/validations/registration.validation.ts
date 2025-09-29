export function isValidEmail(email: string) {
  // Simple, user-friendly check; avoids rejecting valid but rare addresses.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isAtLeast16(isoDate: string) {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  const cutoff = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate());
  return d <= cutoff;
}

/**
 * Validates a personal name:
 * - letters only (Unicode), single spaces allowed between words
 * - no leading/trailing/multiple spaces
 * - at least one letter
 */
export function isValidName(name: string) {
  const n = name.trim();
  // Unicode letters only, allow single spaces between parts
  // Examples: "John", "Mary Jane", "Élodie Cohen"
  const re = /^[\p{L}]+(?: [\p{L}]+)*$/u;
  return re.test(n);
}
