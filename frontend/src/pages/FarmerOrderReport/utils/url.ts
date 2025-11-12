// src/features/farmerOrderReport/utils/url.ts

/**
 * Returns the Farmer Order id from:
 *   - ?id=, ?fo=, or ?farmerOrderId= query params
 *   - last path segment (/farmer/farmer-order-report/:id)
 *   - legacy malformed pattern like: ?id=<id>?=<category>
 */
export function getFarmerOrderIdFromUrl(): string | null {
  try {
    const url = new URL(window.location.href)

    // 1) Normal query params
    const byQuery =
      url.searchParams.get("id") ||
      url.searchParams.get("fo") ||
      url.searchParams.get("farmerOrderId")
    if (byQuery) return byQuery

    // 2) Legacy malformed pattern: id ends up in the value of "id" or even as entire search string.
    // Example href: ...?id=FO123?=fruit
    // Try to salvage an ID-looking token before the first "?=".
    const rawSearch = url.search // includes leading '?'
    if (rawSearch.includes("?=")) {
      const trimmed = rawSearch.replace(/^\?/, "")
      // split by & in case there are multiple params
      const parts = trimmed.split("&")
      for (const p of parts) {
        if (p.startsWith("id=")) {
          const v = p.slice(3)
          const id = v.split("?=")[0]
          if (id) return id
        }
      }
      // if not found under id=, try to take the first token before ?=
      const idFallback = trimmed.split("?=")[0]
      const eqIdx = idFallback.indexOf("=")
      if (eqIdx >= 0) {
        const maybeId = idFallback.slice(eqIdx + 1)
        if (maybeId) return maybeId
      }
    }

    // 3) Last path segment
    const parts = url.pathname.split("/").filter(Boolean)
    if (parts.length) return parts[parts.length - 1]
  } catch {
    // ignore
  }
  return null
}

/**
 * Normalizes category strings into a small set we use in the app.
 * Examples:
 *  - "fruit" -> "fruit"
 *  - "vegetables" -> "vegetable"
 *  - "dairy", "milk", "cheese", "egg_dairy" -> "egg_dairy"
 */
function normalizeCategory(input?: string | null): string {
  const s = String(input ?? "").trim().toLowerCase()
  if (!s) return ""

  // common synonyms -> canonical
  if (/(egg[_\s-]*dairy|eggs?|dairy|milk|cheese|yogh?urt)/.test(s)) return "egg_dairy"
  if (/fruits?/.test(s)) return "fruit"
  if (/(veg|vegetable|vegetables)/.test(s)) return "vegetable"
  if (/produce|farm|fresh/.test(s)) {
    // "produce" isn't a DB category, map to fruit (fallback) unless caller overrides later.
    return "fruit"
  }
  if (/other|misc|general/.test(s)) return "other"

  // already canonical or unknown string (let caller decide)
  return s
}

/**
 * Extracts a category string from URL.
 * Priority:
 *   1) ?category= / ?cat= / ?itemCategory=
 *   2) Legacy malformed pattern "?id=<id>?=<category>"
 *   3) Nothing -> empty string
 *
 * Always returns a normalized, lowercased value suitable for <QualityStandardsSwitch/>.
 */
export function getCategoryFromUrl(): string {
  try {
    const url = new URL(window.location.href)

    // 1) Normal query params
    const byQuery =
      url.searchParams.get("category") ||
      url.searchParams.get("cat") ||
      url.searchParams.get("itemCategory")
    if (byQuery) return normalizeCategory(byQuery)

    // 2) Legacy malformed pattern: ...?id=<id>?=<category>
    const rawSearch = url.search // includes leading '?'
    if (rawSearch.includes("?=")) {
      const after = rawSearch.split("?=")[1] || ""
      // cut off possible &something=... after the legacy pattern
      const catToken = after.split("&")[0]
      return normalizeCategory(decodeURIComponent(catToken))
    }
  } catch {
    // ignore
  }
  return ""
}

/**
 * Generic helper (optional export): safely read a query param.
 */
export function getQueryParam(name: string): string | null {
  try {
    const url = new URL(window.location.href)
    return url.searchParams.get(name)
  } catch {
    return null
  }
}
