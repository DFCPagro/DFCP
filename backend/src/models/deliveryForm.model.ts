import mongoose, { Document, Model } from 'mongoose';
import toJSON from '../utils/toJSON';

export interface IDeliveryForm extends Document {
  shipmentRequestId: mongoose.Types.ObjectId;
  farmerId: mongoose.Types.ObjectId;
  createdAt: Date;
  status: string;
  containers: mongoose.Types.ObjectId[];
}

const DeliveryFormSchema = new mongoose.Schema<IDeliveryForm>({
  shipmentRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShipmentRequest', required: true },
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, default: 'created' },
  containers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Container' }],
}, { timestamps: true });

DeliveryFormSchema.plugin(toJSON as any);

const DeliveryForm: Model<IDeliveryForm> = mongoose.model<IDeliveryForm>('DeliveryForm', DeliveryFormSchema);
export default DeliveryForm;
