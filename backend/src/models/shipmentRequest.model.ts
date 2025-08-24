import mongoose, { Document, Model } from 'mongoose';
import toJSON from '../utils/toJSON';

export interface IShipmentRequest extends Document {
  farmerId: mongoose.Types.ObjectId;
  expectedProduceType: string;
  expectedQuantity: number;
  dueDate: Date;
  status: string;
}

const ShipmentRequestSchema = new mongoose.Schema<IShipmentRequest>({
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
  expectedProduceType: { type: String, required: true },
  expectedQuantity: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, default: 'pending' },
}, { timestamps: true });

ShipmentRequestSchema.plugin(toJSON as any);

const ShipmentRequest: Model<IShipmentRequest> = mongoose.model<IShipmentRequest>('ShipmentRequest', ShipmentRequestSchema);
export default ShipmentRequest;
