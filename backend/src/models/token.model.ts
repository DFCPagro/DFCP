import mongoose, { Document, Model } from 'mongoose';

export interface IToken extends Document {
  user: mongoose.Types.ObjectId;
  tokenHash: string;
  type: 'refresh';
  expires: Date;
  createdAt: Date;
  isBlacklisted: boolean;
  userAgent?: string;
  ip?: string;
}

const TokenSchema = new mongoose.Schema<IToken>({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, index: true },
  type: { type: String, enum: ['refresh'], default: 'refresh' },
  expires: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  isBlacklisted: { type: Boolean, default: false },
  userAgent: { type: String },
  ip: { type: String },
});

TokenSchema.index({ expires: 1 }, { expireAfterSeconds: 0 }); // TTL index

const Token: Model<IToken> = mongoose.model<IToken>('Token', TokenSchema);
export default Token;
