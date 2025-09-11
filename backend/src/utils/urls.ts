import { PUBLIC_APP_URL } from "../config/env";
/** Build the two QR URLs from tokens. */
export const buildQrUrls = (opsToken: string, customerToken: string) => {
  return {
    opsUrl: `${PUBLIC_APP_URL}/o/${opsToken}`,
    customerUrl: `${PUBLIC_APP_URL}/r/${customerToken}`,
  };
}

// put this near the top of the file
export const isHttpUrl = (v?: string | null) => {
  if (v == null || v === "") return true; // allow empty/nullable
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};
