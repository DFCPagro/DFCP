import mongoose from 'mongoose';
import User, { IUser } from './user.model';

export interface IConsumer extends IUser {
  favorites?: string[];
  orderHistory?: mongoose.Types.ObjectId[];
  rating?: number;
}

const Consumer = User.discriminator<IConsumer>('Consumer', new mongoose.Schema({
  favorites: [{ type: String }],
  orderHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  rating: { type: Number, default: 0 },
}));

export default Consumer;
