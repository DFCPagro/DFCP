// controllers/auth.controller.ts
import * as tokenService from "../services/token.service";
import { register as registerSvc, login as loginSvc } from "../services/auth.service";
import { getPublicUserById } from "../services/user.service";
import ApiError from "../utils/ApiError";
import type { Request, Response, CookieOptions } from "express";
import { COOKIE_DOMAIN, COOKIE_SECURE } from "../config/env";

const setRefreshCookie = (res: Response, token: string) => {
  const secure = COOKIE_SECURE;
  const options: CookieOptions = {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
  if (COOKIE_DOMAIN) options.domain = COOKIE_DOMAIN;
  res.cookie("refreshToken", token, options);
};

export async function register(req: Request, res: Response) {
  const { user, accessToken, refreshToken } = await registerSvc(req.body);
  await tokenService.storeRefreshToken(refreshToken, user.id, {
    userAgent: req.get("user-agent") || undefined,
    ip: req.ip,
  });
  setRefreshCookie(res, refreshToken);
  res.status(201).json({ user, tokens: { access: accessToken } });
}

export async function login(req: Request, res: Response) {
  const { user, accessToken, refreshToken } = await loginSvc(req.body);
  await tokenService.storeRefreshToken(refreshToken, user.id, {
    userAgent: req.get("user-agent") || undefined,
    ip: req.ip,
  });
  setRefreshCookie(res, refreshToken);
  res.json({ user, tokens: { access: accessToken } });
}

export async function refresh(req: Request, res: Response) {
  const token =
    (req.cookies?.refreshToken as string | undefined) ||
    (typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined);

  if (!token) throw new ApiError(401, "Missing refresh token");

  const payload = await tokenService.verifyRefreshToken(token);
  if (!payload?.sub) throw new ApiError(401, "Invalid refresh token");

  const newAccess = tokenService.signAccessToken(payload.sub);
  const newRefresh = await tokenService.rotateRefreshToken(token, payload.sub, {
    userAgent: req.get("user-agent") || undefined,
    ip: req.ip,
  });

  setRefreshCookie(res, newRefresh);
  res.json({ tokens: { access: newAccess } });
}

export async function logout(req: Request, res: Response) {
  const token =
    (req.cookies?.refreshToken as string | undefined) ||
    (typeof req.body?.refreshToken === "string" ? req.body.refreshToken : undefined);

  if (token) {
    const payload = await tokenService.verifyRefreshToken(token);
    if (payload?.sub) {
      await tokenService.revokeRefreshToken(token, payload.sub);
    }
  }

  res.clearCookie("refreshToken");
  res.json({ message: "Logged out" });
}

// GET /auth/me (assumes your authenticate middleware sets req.user)
export async function me(req: Request, res: Response) {
  // If your middleware sets req.user, use that:
  // @ts-ignore
  const user = req.user;
  if (!user) throw new ApiError(401, "Unauthorized");
  // If you prefer an id: const userId = String(user._id);
  res.json(await getPublicUserById(String(user._id ?? user.id)));
}
