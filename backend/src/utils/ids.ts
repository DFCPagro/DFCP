import mongoose, { Types } from 'mongoose';
import { BadRequestError } from '../services/order.service';

export const toObjectId = (v?: string) => (v ? new Types.ObjectId(v) : undefined);

export function ensureValidObjectId(id: string, field = 'id') {
  if (!mongoose.isValidObjectId(id)) {
    throw new BadRequestError(`Invalid ${field}`);
  }
}
