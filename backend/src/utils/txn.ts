import mongoose, { ClientSession } from 'mongoose';

/**
 * Run a function inside a transaction if supported; otherwise run without a session.
 * Handles the common "replica set required" fallback for local dev.
 */
export async function withOptionalTxn<T>(fn: (session?: ClientSession) => Promise<T>): Promise<T> {
  let session: ClientSession | undefined;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err: any) {
    if (session) {
      try { await session.abortTransaction(); } catch {}
      session.endSession();
    }
    const msg = String(err?.message || '');
    if (msg.includes('Transaction numbers are only allowed on a replica set') || err?.code === 20) {
      // Fallback if transactions aren’t supported locally (non-replica set)
      return fn(undefined);
    }
    throw err;
  } finally {
    if (session) session.endSession();
  }
}
