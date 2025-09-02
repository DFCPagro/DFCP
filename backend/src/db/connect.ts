// db/connect.ts
import mongoose from "mongoose";
import { MONGODB_URI, NODE_ENV } from "../config/env";

export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Add it to your environment.");
  }

  // Keeps queries predictable, avoids deprecation warnings
  mongoose.set("strictQuery", true);

  // Helpful connection event logs
  mongoose.connection.on("connected", () => {
    const { name, host, port } = mongoose.connection;
    // You can swap to your logger if you prefer
    // eslint-disable-next-line no-console

  });
  mongoose.connection.on("disconnected", () => {
    // eslint-disable-next-line no-console
    console.warn("⚠  MongoDB disconnected");
  });
  mongoose.connection.on("reconnected", () => {
    // eslint-disable-next-line no-console
    console.log("🔄 MongoDB reconnected");
  });
  mongoose.connection.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("❌ MongoDB error:", err);
  });

  // Reasonable Atlas-friendly timeouts/pooling
  await mongoose.connect(MONGODB_URI, {
    maxPoolSize: 20,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 10000, // fail fast if Atlas not reachable
    socketTimeoutMS: 45000,          // keep sockets alive for slow ops
  });

  return mongoose.connection;
};

export const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
};