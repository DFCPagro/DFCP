import mongoose, { Document, Model } from 'mongoose';
import toJSON from '../utils/toJSON';

export interface IVehicle extends Document {
  type?: string;
  capacity?: number;
  status?: string;
  licensePlate?: string;
}

const VehicleSchema = new mongoose.Schema<IVehicle>({
  type: { type: String },
  capacity: { type: Number },
  status: { type: String },
  licensePlate: { type: String, unique: true },
}, { timestamps: true });

VehicleSchema.plugin(toJSON as any);

const Vehicle: Model<IVehicle> = mongoose.model<IVehicle>('Vehicle', VehicleSchema);
export default Vehicle;
