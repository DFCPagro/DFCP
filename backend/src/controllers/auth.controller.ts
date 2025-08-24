import * as tokenService from "../services/token.service";
import {
  register as registerSvc,
  login as loginSvc,
} from "../services/auth.service";
import catchAsync from "../utils/catchAsync";
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
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  if (COOKIE_DOMAIN) {
    options.domain = COOKIE_DOMAIN;
  }

  res.cookie("refreshToken", token, options);
};

export const register = catchAsync(async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await registerSvc(req.body);
  await tokenService.storeRefreshToken(refreshToken, user.id, {
    userAgent: req.get("user-agent") || undefined,
    ip: req.ip,
  });
  setRefreshCookie(res, refreshToken);
  res.status(201).json({ user, tokens: { access: accessToken } });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await loginSvc(req.body);
  await tokenService.storeRefreshToken(refreshToken, user.id, {
    userAgent: req.get("user-agent") || undefined,
    ip: req.ip,
  });
  setRefreshCookie(res, refreshToken);
  res.json({ user, tokens: { access: accessToken } });
});

export const refresh = catchAsync(async (req: Request, res: Response) => {
  const token =
    (req.cookies?.refreshToken as string | undefined) ||
    (typeof req.body?.refreshToken === "string"
      ? req.body.refreshToken
      : undefined);

  if (!token) throw new ApiError(401, "Missing refresh token");

  const payload = await tokenService.verifyRefreshToken(token);
  if (!payload || !payload.sub)
    throw new ApiError(401, "Invalid refresh token");

  const newAccess = tokenService.signAccessToken(payload.sub);
  const newRefresh = await tokenService.rotateRefreshToken(token, payload.sub, {
    userAgent: req.get("user-agent") || undefined,
    ip: req.ip,
  });

  setRefreshCookie(res, newRefresh);
  res.json({ tokens: { access: newAccess } });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  const token =
    (req.cookies?.refreshToken as string | undefined) ||
    (typeof req.body?.refreshToken === "string"
      ? req.body.refreshToken
      : undefined);

  if (!token) return res.json({ message: "Logged out" });

  const payload = await tokenService.verifyRefreshToken(token);
  if (payload && payload.sub) {
    await tokenService.revokeRefreshToken(token, payload.sub);
  }

  res.clearCookie("refreshToken");
  res.json({ message: "Logged out" });
});
