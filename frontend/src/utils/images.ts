// /src/utils/images.ts
// Small helpers for thumbnails & safe fallbacks.
// Works with plain URLs, adds best-effort transforms for Cloudinary/imgix,
// and gives you a consistent placeholder for dev.

export type ThumbOpts = {
  w?: number;         // width in px
  h?: number;         // height in px
  fit?: "cover" | "contain";
  q?: number;         // quality 1..100 (when supported)
};

export function isValidHttpUrl(s: unknown): s is string {
  if (typeof s !== "string" || !s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Simple placeholder (great for dev/demo). */
export function placeholder(seed = "no-image", w = 80, h = 80): string {
  const s = encodeURIComponent(seed);
  return `https://picsum.photos/seed/${s}/${w}/${h}`;
}

/** A tiny inline SVG fallback (never 404s). */
export const FALLBACK_THUMB =
  `data:image/svg+xml;utf8,` +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>
      <rect width='100%' height='100%' fill='#f2f2f2'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
            font-family='sans-serif' font-size='10' fill='#888'>no image</text>
    </svg>`
  );

/**
 * Best-effort thumbnail builder:
 * - Cloudinary: injects /c_fill,w_{w},h_{h},f_auto,q_auto/ after /upload/
 * - imgix-like: appends ?fit=...&w=...&h=...&auto=format&q=...
 * - Otherwise: returns src unchanged
 */
export function buildThumb(src: string | null | undefined, opts: ThumbOpts = {}): string {
  const { w = 80, h = 80, fit = "cover", q } = opts;
  if (!src || !isValidHttpUrl(src)) return placeholder("thumb", w, h);

  // Cloudinary pattern: https://res.cloudinary.com/.../upload/...publicId
  const uploadIdx = src.indexOf("/upload/");
  if (uploadIdx !== -1) {
    const before = src.slice(0, uploadIdx + "/upload/".length);
    const after = src.slice(uploadIdx + "/upload/".length);
    const parts = ["c_fill", `w_${w}`, `h_${h}`, "f_auto", q ? `q_${q}` : "q_auto"];
    return `${before}${parts.join(",")}/${after}`;
  }

  // imgix / generic query-param based CDNs
  try {
    const u = new URL(src);
    // don’t stomp existing params; just set sane defaults
    if (!u.searchParams.has("fit")) u.searchParams.set("fit", fit === "cover" ? "crop" : "min");
    if (!u.searchParams.has("w")) u.searchParams.set("w", String(w));
    if (!u.searchParams.has("h")) u.searchParams.set("h", String(h));
    if (!u.searchParams.has("auto")) u.searchParams.set("auto", "format");
    if (q && !u.searchParams.has("q")) u.searchParams.set("q", String(q));
    return u.toString();
  } catch {
    return src; // unknown scheme → leave as-is
  }
}

/** Resolve the image URL for a crop row with a safe thumbnail + fallback. */
export function resolveCropImage(
  crop: { imageUrl?: string | null; cropName?: string },
  size = 80
): { src: string; fallbackSrc: string } {
  const src = buildThumb(crop?.imageUrl ?? null, { w: size, h: size });
  const fallbackSrc = placeholder(crop?.cropName || "crop", size, size);
  return { src, fallbackSrc };
}
