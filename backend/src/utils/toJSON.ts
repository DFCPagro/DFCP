import { Schema } from 'mongoose';

/** Mongoose plugin to convert mongoose document to JSON */
export default function toJSON(schema: Schema) {
  schema.method('toJSON', function () {
    const obj: any = this.toObject({ virtuals: true });
    obj.id = obj._id;
    delete obj._id;
    delete obj.__v;
    delete obj.password;
    return obj;
  });
}
