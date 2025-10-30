// src/types/contact.ts
export interface ContactInfo {
  name: string;
  email: string;
  phone: string | null;
  role: string;
  farmName?: string;
  farmLogo?: string;
}
