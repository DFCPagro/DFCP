import { Schema, model, Model, HydratedDocument, Types } from "mongoose";
import toJSON from "../utils/toJSON";

const SLOT_NAME =
  /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)-(morning|afternoon|night)$/i;

export interface DemandItemLine {
  /** ref to Item */
  itemId: Types.ObjectId;
  /** optional denormalized label; if not present we’ll use populated Item.name */
  itemDisplayName?: string | null;
  averageDemandQuantityKg: number;
}

export interface DemandStatics {
  slotKey: string; // e.g. "monday-afternoon"
  items: DemandItemLine[];
}

export type DemandStaticsDoc = HydratedDocument<DemandStatics>;

export interface DemandStaticsModel extends Model<DemandStatics> {
  /** Accept {slotKey, items} OR raw {"monday-afternoon": { items }} */
  fromRaw(raw: Record<string, any>): DemandStatics;
  /** Emit raw {"monday-afternoon": { items }} */
  toRaw(doc: DemandStatics | DemandStaticsDoc): Record<string, any>;
}

const DemandItemSchema = new Schema<DemandItemLine>(
  {
    itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true, index: true },
    itemDisplayName: { type: String, default: null, trim: true },
    averageDemandQuantityKg: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const DemandStaticsSchema = new Schema<DemandStatics, DemandStaticsModel>(
  {
    slotKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: SLOT_NAME,
      unique: true,
      index: true,
    },
    items: {
      type: [DemandItemSchema],
      default: [],
      validate: { validator: Array.isArray, message: "items must be an array" },
    },
  },
  { timestamps: true }
);

DemandStaticsSchema.plugin(toJSON as any);
DemandStaticsSchema.index({ slotKey: 1, "items.itemId": 1 });

// ----- statics -----
DemandStaticsSchema.static("fromRaw", function (raw: Record<string, any>) {
  const keys = Object.keys(raw).filter((k) => k !== "_id");
  if (keys.length !== 1) {
    throw new Error(`fromRaw expects one dynamic key; got: ${keys.join(", ")}`);
  }
  const slotKey = keys[0].toLowerCase();
  const inner = raw[slotKey] ?? {};
  const items = Array.isArray(inner.items) ? inner.items : [];

  // allow itemId as string/ObjectId; keep optional itemDisplayName if provided
  const normalizedItems = items.map((it: any) => ({
    itemId: new Types.ObjectId(it.itemId),
    itemDisplayName: it.itemDisplayName ?? null,
    averageDemandQuantityKg: Number(it.averageDemandQuantityKg ?? 0),
  }));

  return { slotKey, items: normalizedItems };
});

DemandStaticsSchema.static("toRaw", function (doc: DemandStatics | DemandStaticsDoc) {
  return { [doc.slotKey.toLowerCase()]: { items: doc.items ?? [] } };
});

export const DemandStaticsModel = model<DemandStatics, DemandStaticsModel>(
  "DemandStatics",
  DemandStaticsSchema
);

export default DemandStaticsModel;
