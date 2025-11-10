import type { Request, Response } from "express";
import ApiError from "../utils/ApiError";
import * as tokenService from "../services/token.service";
import {
  register as registerSvc,
  login as loginSvc,
} from "../services/auth.service";
import { getPublicUserById } from "../services/user.service";

/**
 * POST /auth/register
 * Create-only: no implicit login, no cookies, no tokens.
 * Returns { success: true } on 201.
 */
export async function register(req: Request, res: Response) {
  const result = await registerSvc(req.body);
  res.status(201).json(result);
}

/**
 * POST /auth/login
 * Returns { name, role, accessToken, refreshToken }.
 */
export async function login(req: Request, res: Response) {
  const { name, role, accessToken, refreshToken, logisticCenterId, mdCoins } =
    await loginSvc(req.body);
  res.json({ name, role,mdCoins, logisticCenterId, accessToken, refreshToken });
}

/**
 * POST /auth/refresh
 * Accepts refresh token in request body, returns fresh access & refresh tokens in body.
 * { tokens: { access, refresh } }
 */
export async function refresh(req: Request, res: Response) {
  const token =
    typeof req.body?.refreshToken === "string"
      ? req.body.refreshToken
      : undefined;

  if (!token) throw new ApiError(401, "Missing refresh token");

  const payload = await tokenService.verifyRefreshToken(token);
  if (!payload?.sub) throw new ApiError(401, "Invalid refresh token");

  const logisticCenterId = String(payload.logisticCenterId ?? "");

  const newAccess = tokenService.signAccessToken(payload.sub, logisticCenterId);
  const newRefresh = tokenService.signRefreshToken(
    payload.sub,
    logisticCenterId
  );

  res.json({
    tokens: {
      access: newAccess,
      refresh: newRefresh,
    },
    logisticCenterId,
  });
}

/**
 * POST /auth/logout
 * Stateless tokens: client should delete stored tokens.
 * If your token service tracks refresh tokens server-side, attempt to revoke.
 */
export async function logout(req: Request, res: Response) {
  const token =
    typeof req.body?.refreshToken === "string"
      ? req.body.refreshToken
      : undefined;

  if (token) {
    const payload = await tokenService
      .verifyRefreshToken(token)
      .catch(() => null);
    if (payload?.sub) {
      await tokenService
        .revokeRefreshToken(token, payload.sub)
        .catch(() => void 0);
    }
  }

  res.json({ message: "Logged out" });
}

/**
 * GET /auth/me
 * Assumes authenticate middleware decorates req.user from access token.
 * Supports either attached user object or a token payload containing an id/sub.
 */
export async function me(req: Request, res: Response) {
  // Common middlewares attach either a full user or { _id } or { id }.
  // @ts-ignore - depends on your auth middleware
  const current = req.user;
  if (!current) throw new ApiError(401, "Unauthorized");

  const id = String(current._id ?? current.id ?? current.sub ?? "");
  if (!id) throw new ApiError(401, "Unauthorized");

  const logisticCenterId = current.logisticCenterId ?? null;
  res.json({ ...(await getPublicUserById(id)), logisticCenterId });
}
