import mongoose from 'mongoose';
import User, { IUser } from './user.model';

export interface IAdmin extends IUser {
  managedUsers?: mongoose.Types.ObjectId[];
  analyticsEnabled?: boolean;
}

const Admin = User.discriminator<IAdmin>('Admin', new mongoose.Schema({
  managedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  analyticsEnabled: { type: Boolean, default: false },
}));

export default Admin;
