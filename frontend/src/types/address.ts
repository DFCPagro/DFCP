import { z } from "zod";

// Runtime schema
export const AddressSchema = z.object({
  lnt: z.number(),
  alt: z.number(),
  address: z.string(),
  logisticCenterId: z.string().optional(),
  
});

// TS type inferred automatically from schema
export type Address = z.infer<typeof AddressSchema>;
