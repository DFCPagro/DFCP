import ApiError from "../utils/ApiError";
import { createUser, findUserByEmail } from "./user.service";
import * as tokenService from "./token.service";

export async function register({
  name,
  email,
  password,
  role,
}: {
  name: string;
  email: string;
  password: string;
  role?: any;
}) {
  const existing = await findUserByEmail(email);
  if (existing) throw new ApiError(409, "Email already registered");
  const user = await createUser({ name, email, password, role });
  const accessToken = tokenService.signAccessToken(user.id);
  const refreshToken = tokenService.signRefreshToken(user.id);
  return { user, accessToken, refreshToken };
}

export async function login({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const user = await findUserByEmail(email);
  if (!user) throw new ApiError(401, "Invalid credentials");
  const ok = await user.isPasswordMatch(password);
  if (!ok) throw new ApiError(401, "Invalid credentials");
  const accessToken = tokenService.signAccessToken(user.id);
  const refreshToken = tokenService.signRefreshToken(user.id);
  return { user, accessToken, refreshToken };
}
