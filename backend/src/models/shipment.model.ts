import mongoose, { Document, Model } from 'mongoose';
import toJSON from '../utils/toJSON';

export interface IShipment extends Document {
  driverId?: mongoose.Types.ObjectId;
  vehicleId?: mongoose.Types.ObjectId;
  containers?: mongoose.Types.ObjectId[];
  origin?: string;
  destination?: string;
  status?: string;
  departureTime?: Date;
  arrivalTime?: Date;
  logisticsCenter?: mongoose.Types.ObjectId;
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
}, { timestamps: true });

ShipmentSchema.plugin(toJSON as any);

const Shipment: Model<IShipment> = mongoose.model<IShipment>('Shipment', ShipmentSchema);
export default Shipment;
