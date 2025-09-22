import { api } from "./config"; // reuse the same axios instance as auth.ts
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
  return ContactSchema.parse(data?.data ?? data);
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

/** POST /user/addresses → returns UPDATED LIST */
export async function createUserAddress(
  addr: Pick<Address, "lnt" | "alt" | "address">
): Promise<Address[]> {
  const { data } = await api.post("/users/addresses", addr);
  return AddressListSchema.parse(data?.data ?? data);
}

/* ready for when backend lands */
/*export async function deleteUserAddress(id: string): Promise<Address[]> {
  const { data } = await api.delete(`/user/addresses/${id}`);
  return AddressListSchema.parse(data?.data ?? data);
}*/
export async function updateUserAddress(
  id: string,
  patch: Partial<Pick<Address, "lnt" | "alt" | "address" | "logisticCenterId">>
): Promise<Address[]> {
  const { data } = await api.patch(`/users/addresses/${id}`, patch);
  return AddressListSchema.parse(data?.data ?? data);
}
