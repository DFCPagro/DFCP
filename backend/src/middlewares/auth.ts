import jwt from 'jsonwebtoken';
import ApiError from '../utils/ApiError';
import { roles, Role } from '../utils/constants';
import { Request, Response, NextFunction } from 'express';
import { User } from '../models';
import { Types } from 'mongoose';

export interface JWTPayload {
  sub: string;
  iat?: number;
  exp?: number;
  logisticCenterId?: string; // tokens carry strings
}

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Missing Authorization header');

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as JWTPayload;
    const user = await User.findById(payload.sub);
    if (!user) throw new ApiError(401, 'User not found');

    req.user = user; // HydratedDocument<IUser>
    // user.logisticCenterId is already Types.ObjectId | undefined
    req.logisticCenterId = user.logisticCenterId ?? undefined; // do NOT assign null if type excludes it

    next();
  } catch {
    throw new ApiError(401, 'Invalid or expired token');
  }
};

export const authenticateIfPresent = async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as JWTPayload;
    const user = await User.findById(payload.sub);
    if (!user) throw new ApiError(401, 'User not found');

    req.user = user;

    // Convert the JWT string to ObjectId before assigning
    if (payload.logisticCenterId) {
      if (!Types.ObjectId.isValid(payload.logisticCenterId)) {
        throw new ApiError(400, 'Invalid logisticCenterId in token');
      }
      req.logisticCenterId = new Types.ObjectId(payload.logisticCenterId);
    } else {
      req.logisticCenterId = user.logisticCenterId ?? undefined;
    }

    next();
  } catch {
    throw new ApiError(401, 'Invalid or expired token');
  }
};

export const authorize =
  (...allowed: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) throw new ApiError(401, 'Unauthorized');
    if (!allowed.length) return next();
    if (!roles.includes(user.role) || !allowed.includes(user.role)) {
      throw new ApiError(403, 'Forbidden');
    }
    next();
  };
