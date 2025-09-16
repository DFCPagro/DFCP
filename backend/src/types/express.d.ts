import type { Document } from 'mongoose';
// If you already have a User type/interface, import that instead:
import type { IUser } from '@/models/User'; // adjust path to your model type

declare module 'express-serve-static-core' {
  interface Request {
    // Make it optional so unauthenticated routes can still compile.
    user?: IUser & Document;
  }
}
