import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type QrPurpose = 'ops' | 'customer';

export interface IQrToken extends Document {
  order: Types.ObjectId;
  purpose: QrPurpose;
  token: string;
  expiresAt?: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QrTokenSchema = new Schema<IQrToken>(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    purpose: { type: String, enum: ['ops', 'customer'], required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date },
    usedAt: { type: Date },
  },
  { timestamps: true }
);

const QrToken: Model<IQrToken> = mongoose.model<IQrToken>('QrToken', QrTokenSchema);
export default QrToken;
