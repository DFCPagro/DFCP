export function getFarmerOrderIdFromUrl(): string | null {
  try {
    const url = new URL(window.location.href)
    const byQuery =
      url.searchParams.get("id") ||
      url.searchParams.get("fo") ||
      url.searchParams.get("farmerOrderId")
    if (byQuery) return byQuery
    const parts = url.pathname.split("/").filter(Boolean)
    if (parts.length) return parts[parts.length - 1]
  } catch {}
  return null
}
