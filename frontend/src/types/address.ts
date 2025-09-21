// types/address.ts
import { z } from "zod";

export const AddressSchema = z.object({
  lnt: z.number(),
  alt: z.number(),
  address: z.string(),
  logisticCenterId: z.string().optional(),
});
export type Address = z.infer<typeof AddressSchema>;
export const AddressListSchema = z.array(AddressSchema);
