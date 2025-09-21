// models/logisticsCenter.model.ts
import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import toJSON from '../utils/toJSON';

export interface IGeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}
export interface ILocation {
  name: string;
  geo?: IGeoPoint;
}
export interface ILogisticsCenter extends Document {
  _id: Types.ObjectId;
  logisticName: string;
  location: ILocation;
  employeeIds: Types.ObjectId[];
  deliveryHistory: { message: string; at: Date; by?: Types.ObjectId | null }[];
createdAt?: Date;
    updatedAt?: Date;
}

const GeoPointSchema = new Schema<IGeoPoint>(
  {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (val: number[]) =>
          Array.isArray(val) &&
          val.length === 2 &&
          Number.isFinite(val[0]) &&
          Number.isFinite(val[1]),
        message: 'geo.coordinates must be [lng, lat]',
      },
    },
  },
  { _id: false }
);

const LocationSchema = new Schema<ILocation>(
  {
    name: { type: String, required: true, trim: true },
    // Optional subdocument; if present, its own fields are required
    geo: { type: GeoPointSchema, required: false, default: undefined },
  },
  { _id: false }
);

const LogisticsCenterSchema = new Schema<ILogisticsCenter>(
  {
    logisticName: { type: String, required: true, trim: true, index: true },
    location: { type: LocationSchema, required: true },
    employeeIds: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
    deliveryHistory: [
      {
        message: { type: String, required: true, trim: true },
        at: { type: Date, default: Date.now },
        by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      },
    ],
  },
  { timestamps: true }
);

LogisticsCenterSchema.index({ 'location.geo': '2dsphere' });
LogisticsCenterSchema.plugin(toJSON as any);

const LogisticsCenter: Model<ILogisticsCenter> =
  mongoose.model<ILogisticsCenter>('LogisticCenter', LogisticsCenterSchema);

export default LogisticsCenter;
