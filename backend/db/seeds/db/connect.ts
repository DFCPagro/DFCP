import mongoose from "mongoose";

let cachedConn: mongoose.Connection | null = null;

/**
 * Establish a Mongoose connection.
 * If `dbName` is omitted, the database encoded in the URI is used.
 */
export async function connectDB(
  uri?: string,
  dbName?: string
): Promise<mongoose.Connection> {
  if (cachedConn && cachedConn.readyState === 1) {
    return cachedConn;
  }

  const mongoUri = uri || process.env.MONGODB_URI || "mongodb://localhost:27017";
  const database = dbName || process.env.MONGODB_DB; // optional; can be undefined
  const maxRetries = 5;
  const baseDelayMs = 500;

  let lastErr: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Only include dbName if it’s defined (avoids overriding URI’s db when undefined)
      await mongoose.connect(mongoUri, {
        dbName: database || undefined,
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 10,
      });
      cachedConn = mongoose.connection;
      return cachedConn;
    } catch (err) {
      lastErr = err;
      const delay = baseDelayMs * 2 ** attempt;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastErr;
}

/** Cleanly close the Mongoose connection. */
export async function disconnectDB(): Promise<void> {
  if (cachedConn) {
    await cachedConn.close();
    cachedConn = null;
  } else {
    await mongoose.disconnect();
  }
}
