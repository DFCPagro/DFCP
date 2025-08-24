import mongoose from 'mongoose';
import User, { IUser } from './user.model';

export interface IDriver extends IUser {
  availability?: Date[];
  assignedDeliveries?: string[];
  rating?: number;
  vehicle?: mongoose.Types.ObjectId;
}

const Driver = User.discriminator<IDriver>('Driver', new mongoose.Schema({
  availability: [{ type: Date }],
  assignedDeliveries: [{ type: String }],
  rating: { type: Number, default: 0 },
  vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
}));

export default Driver;
