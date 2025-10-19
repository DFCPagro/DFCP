import type { ScanResponse } from "@/types/qrToken";
import { api } from "./config"; // assumes your provided axios instance is exported from here

export async function scan(token: string) {
  const res = await api.post<ScanResponse>(`/scan/${token}`);
  return res.data;
}

