import jwt from 'jsonwebtoken';
import ApiError from '../utils/ApiError';
import { roles, Role } from '../utils/constants';
import { Request, Response, NextFunction } from 'express';
import { User } from '../models';

export interface JWTPayload { sub: string; iat?: number; exp?: number; }

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Missing Authorization header');
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as JWTPayload;
    const user = await User.findById(payload.sub);
    if (!user) throw new ApiError(401, 'User not found');
    // @ts-ignore attach user to req
    req.user = user;
    console.log("User in req:", req.user); // Debug line to check req.user

    next();
  } catch (e) {
    throw new ApiError(401, 'Invalid or expired token');
  }
};

export const authorize = (...allowed: Role[]) => (req: Request, _res: Response, next: NextFunction) => {
  // @ts-ignore
  const user = req.user;
  if (!user) throw new ApiError(401, 'Unauthorized');
  if (!allowed.length) return next();
  if (!roles.includes(user.role) || !allowed.includes(user.role)) {
    throw new ApiError(403, 'Forbidden');
  }
  next();
};
