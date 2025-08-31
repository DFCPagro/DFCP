// src/utils/crypto.ts
// Tiny crypto helpers for tokens

// Node 18+ has global crypto.webcrypto, but we also fallback to node:crypto
export function cryptoRandom(bytes: number): Buffer {
  const nodeCrypto = (global as any).crypto ?? require('crypto');
  if (nodeCrypto?.webcrypto?.getRandomValues) {
    const arr = new Uint8Array(bytes);
    nodeCrypto.webcrypto.getRandomValues(arr);
    return Buffer.from(arr);
  }
  return require('crypto').randomBytes(bytes);
}

/** Base64url-encode a Buffer (RFC 4648 §5). */
export function toBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/** Generate a random base64url token. 24 bytes ≈ 192-bit token. */
export function randToken(bytes = 24): string {
  return toBase64Url(cryptoRandom(bytes));
}
