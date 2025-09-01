import mongoose, { Document, Model, Schema, Types } from 'mongoose';

/**
 * Types of QR tokens supported by the platform. Tokens can be minted for:
 * - ops:      public order view for operations/support
 * - customer: delivery confirmation + rating by consumer
 * - aggregation: farmer batch/aggregation public view
 * - arrival:  logistics arrival confirmation for a shipment
 */
export type QrPurpose = 'ops' | 'customer' | 'aggregation' | 'arrival';

export interface IQrToken extends Document {
  order?: Types.ObjectId;        // optional for ops/customer
  aggregation?: Types.ObjectId;  // for aggregation purpose
  shipment?: Types.ObjectId;     // for arrival purpose
  purpose: QrPurpose;
  token: string;
  expiresAt?: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QrTokenSchema = new Schema<IQrToken>(
  {
    order:       { type: Schema.Types.ObjectId, ref: 'Order', index: true, required: false },
    aggregation: { type: Schema.Types.ObjectId, ref: 'Aggregation', index: true, required: false },
    shipment:    { type: Schema.Types.ObjectId, ref: 'Shipment', index: true, required: false },
    purpose:     { type: String, enum: ['ops', 'customer', 'aggregation', 'arrival'], required: true, index: true },
    token:       { type: String, required: true, unique: true, index: true },
    expiresAt:   { type: Date },
    usedAt:      { type: Date },
  },
  { timestamps: true }
);

const QrToken: Model<IQrToken> = mongoose.model<IQrToken>('QrToken', QrTokenSchema);
export default QrToken;
