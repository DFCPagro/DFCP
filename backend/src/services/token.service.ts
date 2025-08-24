import jwt from "jsonwebtoken";
import crypto from "crypto";
import Token from "../models/token.model";

// Minimal payload we rely on
type DecodedPayload = {
  sub?: string;
  exp?: number;
  iat?: number;
} & Record<string, unknown>;

/** Access token: short-lived */
export function signAccessToken(userId: string) {
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
  return jwt.sign({ sub: userId }, process.env.JWT_ACCESS_SECRET as string, { expiresIn });
}

/** Refresh token: long-lived */
export function signRefreshToken(userId: string) {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
  return jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET as string, { expiresIn });
}

/** SHA-256 hash (store only hashes of refresh tokens) */
export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Persist hashed refresh token for rotation/revocation */
export async function storeRefreshToken(
  token: string,
  userId: string,
  meta: { userAgent?: string; ip?: string } = {}
) {
  const payload = jwt.decode(token) as DecodedPayload | null;
  if (!payload?.exp) throw new Error("Invalid refresh token (no exp)");
  const expires = new Date(payload.exp * 1000);
  return Token.create({
    user: userId,
    tokenHash: hashToken(token),
    expires,
    userAgent: meta.userAgent,
    ip: meta.ip,
  });
}

/** Rotate refresh: delete old, issue & store new */
export async function rotateRefreshToken(
  oldToken: string,
  userId: string,
  meta: { userAgent?: string; ip?: string } = {}
) {
  await Token.deleteOne({ user: userId, tokenHash: hashToken(oldToken) });
  const newToken = signRefreshToken(userId);
  await storeRefreshToken(newToken, userId, meta);
  return newToken;
}

/** Verify refresh, ensure it exists in DB (not revoked/expired) */
export async function verifyRefreshToken(token: string) {
  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_REFRESH_SECRET as string
    ) as DecodedPayload;

    if (!payload?.sub) return null;

    const exists = await Token.findOne({
      user: payload.sub,
      tokenHash: hashToken(token),
      isBlacklisted: false,
    });

    if (!exists) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Revoke a refresh token (by hash) */
export async function revokeRefreshToken(token: string, userId: string) {
  await Token.deleteOne({ user: userId, tokenHash: hashToken(token) });
}
