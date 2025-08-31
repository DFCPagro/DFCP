import { PUBLIC_APP_URL } from "../config/env";
/** Build the two QR URLs from tokens. */
export function buildQrUrls(opsToken: string, customerToken: string) {
  return {
    opsUrl: `${PUBLIC_APP_URL}/o/${opsToken}`,
    customerUrl: `${PUBLIC_APP_URL}/r/${customerToken}`,
  };
}
