import mongoose, { Document, Model } from 'mongoose';
import toJSON from '../utils/toJSON';

export interface ILogisticsCenter extends Document {
  location: string;
  activeOrders?: mongoose.Types.ObjectId[];
  employeeIds?: mongoose.Types.ObjectId[];
  deliveryHistory?: string[];
}

const LogisticsCenterSchema = new mongoose.Schema<ILogisticsCenter>({
  location: { type: String, required: true },
  activeOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  employeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deliveryHistory: [{ type: String }],
}, { timestamps: true });

LogisticsCenterSchema.plugin(toJSON as any);

const LogisticsCenter: Model<ILogisticsCenter> = mongoose.model<ILogisticsCenter>('LogisticsCenter', LogisticsCenterSchema);
export default LogisticsCenter;
