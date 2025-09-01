import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import toJSON from '../utils/toJSON';

/**
 * An aggregation represents a batch of produce prepared by a farmer. It may
 * contain multiple line items (e.g. "2t tomatoes", "1.5t cucumbers") and
 * optionally a list of container IDs that were loaded as part of the batch.
 * A unique token is generated for each aggregation to allow scanning and
 * lookup at the logistics centre without exposing database identifiers.
 */
export interface IAggregationItem {
  produceType: string;
  quantity: number;
  unit?: string;
}

export interface IAggregation extends Document {
  farmerId: Types.ObjectId;
  items: IAggregationItem[];
  containers?: Types.ObjectId[];
  /** Random token for QR code scanning. */
  token: string;
  /** Optional expiration. Aggregations generally should not live forever. */
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AggregationItemSchema = new Schema<IAggregationItem>({
  produceType: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String },
}, { _id: false });

const AggregationSchema = new Schema<IAggregation>({
  farmerId: { type: Schema.Types.ObjectId, ref: 'Farmer', required: true, index: true },
  items: { type: [AggregationItemSchema], required: true },
  containers: [{ type: Schema.Types.ObjectId, ref: 'Container' }],
  token: { type: String, required: true, unique: true, index: true },
  expiresAt: { type: Date },
}, { timestamps: true });

AggregationSchema.plugin(toJSON as any);

const Aggregation: Model<IAggregation> = mongoose.model<IAggregation>('Aggregation', AggregationSchema);
export default Aggregation;