import { api } from "./config";
import { z } from "zod";
import { AddressListSchema, type Address } from "@/types/address";
import { ContactInfoSchema } from "@/types/user";
import type { ContactInfo } from "@/types/user";

/* ---------- Zod helpers (null/undefined → safe types) ---------- */

// required string: null/undefined -> "", everything -> String(v)
const zRequiredString = z.preprocess(
  (v) => (v == null ? "" : String(v)),
  z.string()
);

// email that allows empty string when server sends null/empty
const zEmailString = z.preprocess(
  (v) => (v == null ? "" : String(v)),
  z.string().email().or(z.literal(""))
);

// optional string: null/undefined -> undefined, else String(v)
const zOptionalString = z.preprocess(
  (v) => (v == null ? undefined : String(v)),
  z.string().optional()
);

/* -------- Contact -------- */
export const ContactSchema = z.object({
  name: zOptionalString,
  email: zEmailString, // <- tolerant to null → ""
  phone: zRequiredString, // <- tolerant to null → ""
  birthday: zOptionalString,
});
export type Contact = z.infer<typeof ContactSchema>;

function normalizeContact(raw: any): Contact {
  // normalize alternate keys first
  if (raw?.birthDate && !raw?.birthday) raw.birthday = raw.birthDate;
  // Zod will now coerce nulls safely
  return ContactSchema.parse(raw ?? {});
}

export async function getUserContact(): Promise<Contact> {
  const { data } = await api.get("/users/contact");
  const raw = data?.data ?? data;
  return normalizeContact(raw);
}

export async function updateUserContact(
  p: Partial<Pick<Contact, "email" | "phone">>
): Promise<Contact> {
  // send through as-is (server decides), parse response defensively
  const { data } = await api.patch("/users/contact", p);
  const raw = data?.data ?? data;
  return normalizeContact(raw);
}

/* -------- Addresses -------- */
export async function getUserAddresses(): Promise<Address[]> {
  const { data } = await api.get("/users/addresses");
  return AddressListSchema.parse(data?.data ?? data);
}

/** POST /users/addresses → returns UPDATED LIST */
export async function createUserAddress(
  addr: Pick<Address, "lnt" | "alt" | "address">
): Promise<Address[]> {
  const { data } = await api.post("/users/addresses", addr);
  return AddressListSchema.parse(data?.data ?? data);
}

/** DELETE /users/addresses with body { lnt, alt, address } → UPDATED LIST */
export async function deleteUserAddress(
  addr: Pick<Address, "lnt" | "alt" | "address">
): Promise<Address[]> {
  const { data } = await api.delete("/users/addresses", { data: addr });
  return AddressListSchema.parse(data?.data ?? data);
}

/* Optional future PATCH-by-id */
export async function updateUserAddress(
  id: string,
  patch: Partial<Pick<Address, "lnt" | "alt" | "address" | "logisticCenterId">>
): Promise<Address[]> {
  const { data } = await api.patch(`/users/addresses/${id}`, patch);
  return AddressListSchema.parse(data?.data ?? data);
}

export async function getContactInfoById(id: string): Promise<ContactInfo> {
  const { data } = await api.get(`/users/contact-info/${id}`);
  const res = data?.data ?? data;
  return ContactInfoSchema.parse(res);
}
