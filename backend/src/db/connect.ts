import mongoose from "mongoose";
import { MONGODB_URI } from "../config/env";

export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  await mongoose.connect(MONGODB_URI);
  return mongoose.connection;
};

export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
};
