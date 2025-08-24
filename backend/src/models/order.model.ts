import mongoose, { Document, Model } from 'mongoose';
import toJSON from '../utils/toJSON';

export interface IOrderItem {
  productId: string;
  quantity: number;
  sourceFarmerId?: mongoose.Types.ObjectId;
}

export interface IOrder extends Document {
  orderId?: string;
  consumerId: mongoose.Types.ObjectId;
  assignedDriverId?: mongoose.Types.ObjectId;
  status: string;
  deliverySlot?: Date;
  items: IOrderItem[];
}

const ItemSchema = new mongoose.Schema<IOrderItem>({
  productId: { type: String, required: true },
  quantity: { type: Number, required: true },
  sourceFarmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer' },
}, { _id: false });

const OrderSchema = new mongoose.Schema<IOrder>({
  orderId: { type: String, unique: true },
  consumerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consumer', required: true },
  assignedDriverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  status: { type: String, default: 'created' },
  deliverySlot: { type: Date },
  items: [ItemSchema],
}, { timestamps: true });

OrderSchema.plugin(toJSON as any);

const Order: Model<IOrder> = mongoose.model<IOrder>('Order', OrderSchema);
export default Order;
