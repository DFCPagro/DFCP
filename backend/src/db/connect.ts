// db/connect.ts
import mongoose from "mongoose";
import { MONGODB_URI, NODE_ENV } from "../config/env";

export const connectDB = async (): Promise<typeof mongoose.connection> => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Add it to your environment.");
  }

  mongoose.set("strictQuery", true);

  mongoose.connection.on("connected", () => {
    const { name, host, port } = mongoose.connection;
    console.log(`✅ MongoDB connected: ${name} @ ${host}:${port}`);
  });
  mongoose.connection.on("disconnected", () => {
    console.warn("⚠️  MongoDB disconnected");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("🔄 MongoDB reconnected");
  });
  mongoose.connection.on("error", (err) => {
    console.error("❌ MongoDB error:", err);
  });

  const maxRetries = NODE_ENV === "development" ? Infinity : 10;
  let attempt = 0;

  for (;;) {
    try {
      await mongoose.connect(MONGODB_URI, {
        maxPoolSize: 20,
        minPoolSize: 0,
        serverSelectionTimeoutMS: 10_000,
        socketTimeoutMS: 45_000,
      });
      console.log("✅ MongoDB connection established");
      return mongoose.connection;
    } catch (err: unknown) {
      attempt++;

      // Safely extract a message
      const msg =
        err instanceof Error ? err.message : JSON.stringify(err);

      console.error(`Mongo connect attempt ${attempt} failed: ${msg}`);

      if (attempt >= maxRetries) {
        console.error("❌ MongoDB failed after max retries, exiting.");
        throw err;
      }

      // Wait 1 second before retrying
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
};

export const disconnectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
};
