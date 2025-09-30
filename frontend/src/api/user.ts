import { api } from "./config";
import { z } from "zod";
import { AddressListSchema, type Address } from "@/types/address";

/* -------- Contact -------- */
export const ContactSchema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  phone: z.string(),
  birthday: z.string().optional(),
});
export type Contact = z.infer<typeof ContactSchema>;

export async function getUserContact(): Promise<Contact> {
  const { data } = await api.get("/users/contact");
  const raw = (data?.data ?? data) as any;
  // normalize alternate keys
  if (raw?.birthDate && !raw?.birthday) raw.birthday = raw.birthDate;
  return ContactSchema.parse(raw);
}

export async function updateUserContact(
  p: Partial<Pick<Contact, "email" | "phone">>
): Promise<Contact> {
  const { data } = await api.patch("/users/contact", p);
  return ContactSchema.parse(data?.data ?? data);
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
