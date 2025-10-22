import { z } from "zod";

/* ---------- helpers ---------- */

// coerce number-ish values and ensure they’re finite
const zNumberCoerced = z.preprocess((v) => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : NaN;
}, z.number());

// treat null/undefined as "", then require non-empty
const zNonEmptyString = z.preprocess(
  (v) => (v == null ? "" : String(v).trim()),
  z.string().min(1)
);

// allow null or string for LC id, normalize to string or null
const zLcId = z.preprocess(
  (v) => (v == null ? null : String(v)),
  z.string().min(1).nullable()
);

// normalize note to trimmed string, default ""
const zNote = z.preprocess(
  (v) => (v == null ? "" : String(v).trim()),
  z.string()
);

/* ---------- input ---------- */

// Accept either {lnt,alt} or {lat,lng} and normalize
const AddressInputSchema = z.object({
  lnt: zNumberCoerced.optional(), // longitude-ish
  alt: zNumberCoerced.optional(), // latitude-ish
  lat: zNumberCoerced.optional(),
  lng: zNumberCoerced.optional(),
  address: zNonEmptyString.optional(),
  logisticCenterId: zLcId.optional(),
  note: zNote.optional(),
});

/* ---------- output (aligned with backend) ---------- */

export const AddressSchema = AddressInputSchema.transform((raw) => {
  // Correct mapping:
  // lnt <= lng, alt <= lat
  const lnt = raw.lnt ?? raw.lng;
  const alt = raw.alt ?? raw.lat;
  const address = raw.address ?? "";
  const note = raw.note ?? "";
  return {
    lnt,
    alt,
    address,
    logisticCenterId: raw.logisticCenterId ?? null,
    note,
  };
}).pipe(
  z.object({
    lnt: z.number(),
    alt: z.number(),
    address: z.string().min(1),
    logisticCenterId: z.string().nullable(),
    note: z.string(),
  })
);

export type Address = z.infer<typeof AddressSchema>;

export const AddressListSchema = z
  .array(AddressSchema)
  .transform((list) =>
    list.filter(
      (a) =>
        Number.isFinite(a.lnt) &&
        Number.isFinite(a.alt) &&
        a.address.trim().length > 0
    )
  );
