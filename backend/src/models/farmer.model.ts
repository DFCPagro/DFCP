import mongoose from 'mongoose';
import User, { IUser } from './user.model';

export interface IFarmer extends IUser {
  farmSize?: number;
  produceTypes?: string[];
  insurance?: boolean;
  bankDetails?: string;
}

const Farmer = User.discriminator<IFarmer>('Farmer', new mongoose.Schema({
  farmSize: { type: Number },
  produceTypes: [{ type: String }],
  insurance: { type: Boolean, default: false },
  bankDetails: { type: String },
}));

export default Farmer;
