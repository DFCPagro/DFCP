import * as tokenService from "../services/token.service";
import { register as registerSvc, login as loginSvc } from "../services/auth.service";
import { getPublicUserById } from "../services/user.service";
import ApiError from "../utils/ApiError";
import type { Request, Response } from "express";

/**
 * POST /auth/register
 * Create-only: no implicit login, no cookies, no tokens.
 * Returns { success: true } on 201.
 */
export async function register(req: Request, res: Response) {
  const result = await registerSvc(req.body);
  // result is { success: true }
  res.status(201).json(result);
}

/**
 * POST /auth/login
 * Returns { name, role, accessToken, refreshToken } — no id, no email, no cookies.
 */
export async function login(req: Request, res: Response) {
  const { name, role, accessToken, refreshToken } = await loginSvc(req.body);
  // No server cookie; client stores tokens.
  res.json({ name, role, accessToken, refreshToken });
}

/**
 * POST /auth/refresh
 * Accepts refresh token in request body, returns fresh access & refresh tokens in body.
 * { tokens: { access, refresh } }
 */
export async function refresh(req: Request, res: Response) {
  const token =
    typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined;

  if (!token) throw new ApiError(401, "Missing refresh token");

  const payload = await tokenService.verifyRefreshToken(token);
  if (!payload?.sub) throw new ApiError(401, "Invalid refresh token");

  const newAccess = tokenService.signAccessToken(payload.sub);
  // Re-issue a new refresh token; no server cookie involved.
  const newRefresh = tokenService.signRefreshToken(payload.sub);

  res.json({ tokens: { access: newAccess, refresh: newRefresh } });
}

/**
 * POST /auth/logout
 * Stateless tokens: client should delete stored tokens.
 * If your token service tracks refresh tokens server-side, attempt to revoke.
 */
export async function logout(req: Request, res: Response) {
  const token =
    typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined;

  if (token) {
    const payload = await tokenService.verifyRefreshToken(token).catch(() => null);
    if (payload?.sub) {
      // If your implementation maintains a store/whitelist/blacklist, this will revoke it.
      await tokenService.revokeRefreshToken(token, payload.sub).catch(() => void 0);
    }
  }

  res.json({ message: "Logged out" });
}

/**
 * GET /auth/me
 * Assumes authenticate middleware decorates req.user from access token.
 */
export async function me(req: Request, res: Response) {
  // @ts-ignore
  const user = req.user;
  if (!user) throw new ApiError(401, "Unauthorized");
  res.json(await getPublicUserById(String(user._id ?? user.id)));
}
