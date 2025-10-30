import type { HydratedDocument, Types } from 'mongoose';
import type { IUser } from '@/models/User'; // adjust path as needed

declare module 'express-serve-static-core' {
  interface Request {
    user?: HydratedDocument<IUser>;
    logisticCenterId?: Types.ObjectId;
  }
}
