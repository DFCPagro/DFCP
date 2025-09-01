import mongoose, { Document, Model, Types } from 'mongoose';
import toJSON from '../utils/toJSON';

export interface IShipment extends Document {
  driverId?: Types.ObjectId;
  vehicleId?: Types.ObjectId;
  containers?: Types.ObjectId[];
  origin?: string;
  destination?: string;
  status?: string;
  departureTime?: Date;
  arrivalTime?: Date;
  logisticsCenter?: Types.ObjectId;
  /** New fields for arrival QR flow */
  arrivalToken?: string | null;
  arrivalExpiresAt?: Date | null;
  arrivalUsedAt?: Date | null;
}

const ShipmentSchema = new mongoose.Schema<IShipment>({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
  containers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Container' }],
  origin: { type: String },
  destination: { type: String },
  status: { type: String, default: 'planned' },
  departureTime: { type: Date },
  arrivalTime: { type: Date },
  logisticsCenter: { type: mongoose.Schema.Types.ObjectId, ref: 'LogisticsCenter' },

  // New arrival fields
  arrivalToken: { type: String, unique: true, sparse: true, index: true },
  arrivalExpiresAt: { type: Date },
  arrivalUsedAt: { type: Date },
}, { timestamps: true });

ShipmentSchema.plugin(toJSON as any);

const Shipment: Model<IShipment> = mongoose.model<IShipment>('Shipment', ShipmentSchema);
export default Shipment;
