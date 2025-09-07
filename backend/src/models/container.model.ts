import mongoose, { Document, Model } from 'mongoose';
import toJSON from '../utils/toJSON';

/*
farmerOrder ref 
QS -filled by farmer
QS- filled by LC

*/ 



export interface IContainer extends Document {
  produceType: string;
  quantity: number;
  weight?: number;
  qualityGrade?: string;
  barcode?: string;
  reportedBy?: mongoose.Types.ObjectId;
}

const ContainerSchema = new mongoose.Schema<IContainer>({
  produceType: { type: String, required: true },
  quantity: { type: Number, required: true },
  weight: { type: Number },
  qualityGrade: { type: String },
  barcode: { type: String, unique: true },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer' },
}, { timestamps: true });

ContainerSchema.plugin(toJSON as any);

const Container: Model<IContainer> = mongoose.model<IContainer>('Container', ContainerSchema);
export default Container;
