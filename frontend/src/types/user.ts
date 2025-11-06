// src/types/user.ts
import { z } from "zod";

export const ContactInfoSchema = z.object({
  name: z.string(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  role: z.string().optional().nullable(),

  // you said /user/contact-info/:id now returns this:
  logisticCenterId: z.string().optional().nullable(),

  // for Farmer List page:
  farmName: z.string().optional().nullable(),
  farmLogo: z.string().url().optional().nullable(),
});
export type ContactInfo = z.infer<typeof ContactInfoSchema>;
