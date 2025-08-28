import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const ORDER_STATUSES = [
  'created',
  'packed',
  'out_for_delivery',
  'delivered',
  'confirmed',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface IOrderItem {
  productId: string;
  quantity: number;
  sourceFarmerId?: Types.ObjectId;
}

export interface IOrder extends Document {
  orderId?: string;
  consumerId: Types.ObjectId;
  assignedDriverId?: Types.ObjectId;
  status: OrderStatus;   // 👈 now strongly typed
  deliverySlot?: Date;
  items: IOrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

const ItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: String, required: true },
    quantity: { type: Number, required: true },
    sourceFarmerId: { type: Schema.Types.ObjectId, ref: 'Farmer' },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderId: { type: String, unique: true, sparse: true },
    consumerId: { type: Schema.Types.ObjectId, ref: 'Consumer', required: true },
    assignedDriverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
    status: {
      type: String,
      enum: ORDER_STATUSES,     // 👈 enforce at Mongo schema level too
      default: 'created',
    },
    deliverySlot: { type: Date },
    items: { type: [ItemSchema], required: true },
  },
  { timestamps: true }
);

const Order: Model<IOrder> = mongoose.model<IOrder>('Order', OrderSchema);
export default Order;
