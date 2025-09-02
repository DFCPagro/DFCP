import mongoose, { Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import toJSON from '../utils/toJSON';
import { Role, roles } from '../utils/constants';

export interface IUser extends Document {
  uid?: string;
  name: string;
  email: string;
  birthday?: Date;
  phone?: string;
  role: Role;
  status: boolean;
  password: string;
  isPasswordMatch(plain: string): Promise<boolean>;
}

const userOptions = { discriminatorKey: 'kind', timestamps: true };

const UserSchema = new mongoose.Schema<IUser>({
  uid: { type: String, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  birthday: { type: Date },
  phone: { type: String },
  role: { type: String, enum: roles, default: 'customer' },
  status: { type: Boolean, default: true },
  password: { type: String, required: true, minlength: 6 },
}, userOptions);

UserSchema.plugin(toJSON as any);

UserSchema.pre('save', async function (next) {
  const doc = this as IUser;
  if (!doc.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  doc.password = await bcrypt.hash(doc.password, salt);
  next();
});

UserSchema.methods.isPasswordMatch = function (plain: string) {
  return bcrypt.compare(plain, this.password);
};

const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
export default User;
