import { z } from "zod";

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

// Accept either {lnt,alt} or {lat,lng} and normalize
const AddressInputSchema = z.object({
  lnt: zNumberCoerced.optional(),
  alt: zNumberCoerced.optional(),
  lat: zNumberCoerced.optional(),
  lng: zNumberCoerced.optional(),
  address: zNonEmptyString.optional(),
  logisticCenterId: zLcId.optional(),
});

export const AddressSchema = AddressInputSchema.transform((raw) => {
  const lnt = raw.lnt ?? raw.lat;
  const alt = raw.alt ?? raw.lng;
  const address = raw.address ?? "";
  return {
    lnt,
    alt,
    address,
    logisticCenterId: raw.logisticCenterId ?? null,
  };
}).pipe(
  z.object({
    lnt: z.number(),
    alt: z.number(),
    address: z.string().min(1),
    logisticCenterId: z.string().nullable(),
  })
);

export type Address = z.infer<typeof AddressSchema>;

export const AddressListSchema = z
  .array(AddressSchema)
  // filter out any that still failed number checks (just in case)
  .transform((list) =>
    list.filter(
      (a) =>
        Number.isFinite(a.lnt) &&
        Number.isFinite(a.alt) &&
        a.address.trim().length > 0
    )
  );
