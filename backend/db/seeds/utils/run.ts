// seeds/utils/run.ts
import readline from "readline";
import type { SeedContext } from "../types";
import type { Model } from "mongoose";

/* ───────────────────────── Timing / Prompts / Summary ───────────────────── */

export async function withTimer<T>(label: string, fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = Date.now();
  const result = await fn();
  const ms = Date.now() - t0;
  console.log(`⏱️  ${label} — ${ms} ms`);
  return { result, ms };
}

export async function promptConfirm(question: string): Promise<boolean> {
  const autoYes = process.env.CI === "true" || !process.stdin.isTTY || !process.stdout.isTTY;
  if (autoYes) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans: string = await new Promise((res) => rl.question(`${question} [y/N] `, (v) => res(v)));
  rl.close();
  return /^y(es)?$/i.test(ans.trim());
}

export function printSummary(rows: Array<{ name: string; inserted: number; upserted: number; ms: number }>) {
  if (!rows.length) return console.log("No seeders ran.");
  const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);
  const header = pad("seeder", 28) + "  " + pad("inserted", 10) + pad("upserted", 10) + pad("ms", 10);
  console.log("\nSummary");
  console.log(header);
  console.log("-".repeat(header.length));
  let ti = 0, tu = 0, tm = 0;
  for (const r of rows) {
    ti += r.inserted; tu += r.upserted; tm += r.ms;
    console.log(pad(r.name, 28) + "  " + pad(String(r.inserted), 10) + pad(String(r.upserted), 10) + pad(String(r.ms), 10));
  }
  console.log("-".repeat(header.length));
  console.log(pad("TOTAL", 28) + "  " + pad(String(ti), 10) + pad(String(tu), 10) + pad(String(tm), 10));
}

/* ─────────────────────────── Model-based helpers ─────────────────────────── */

/** Clear via a Mongoose Model (respects dryRun). */
export async function clearModel(ctx: SeedContext, Model: Model<any>): Promise<void> {
  if (ctx.dryRun) {
    console.log(`[dry] Would clear collection "${Model.collection.name}" via model ${Model.modelName}`);
    return;
  }
  const res = await Model.deleteMany({});
  console.log(`🧹 Cleared "${Model.collection.name}" (deleted ${res.deletedCount ?? 0})`);
}

/** Upsert docs through a **Mongoose Model** so validators/middleware run. */
export async function bulkUpsertModel(
  Model: Model<any>,
  docs: any[],
  keys: string[],
  batchSize = 500,
  dryRun = false
): Promise<{ inserted: number; upserted: number }> {
  if (!Array.isArray(docs) || docs.length === 0) return { inserted: 0, upserted: 0 };
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error(`bulkUpsertModel(${Model.modelName}): upsert keys must be a non-empty string[]`);
  }

  const makeFilter = (doc: any) => {
    const f: Record<string, any> = {};
    for (const k of keys) if (doc[k] !== undefined) f[k] = doc[k];
    if (Object.keys(f).length === 0 && doc._id !== undefined) f._id = doc._id;
    if (Object.keys(f).length === 0) {
      throw new Error(
        `bulkUpsertModel(${Model.modelName}): document missing all upsert keys (${keys.join(", ")}) and _id`
      );
    }
    return f;
  };

  let inserted = 0, upserted = 0;

  for (let i = 0; i < docs.length; i += batchSize) {
    const chunk = docs.slice(i, i + batchSize);

    const ops = await Promise.all(chunk.map(async (raw) => {
      const filter = makeFilter(raw);

      if (dryRun) {
        // never set _id in $set
        const setDoc = { ...raw }; delete (setDoc as any)._id;
        const update: any = { $set: setDoc };
        // if filter doesn’t contain _id but doc has it, put it in $setOnInsert
        if (raw._id != null && (filter as any)._id == null) {
          update.$setOnInsert = { _id: raw._id };
        }
        return { updateOne: { filter, update, upsert: true } };
      }

      // Validate/cast through Mongoose first
      const m = new Model(raw);
      await m.validate();
      const plain = m.toObject({ depopulate: true });

      const setDoc = { ...plain }; delete (setDoc as any)._id; // critical line!

      const update: any = { $set: setDoc };
      if (plain._id != null && (filter as any)._id == null) {
        update.$setOnInsert = { _id: plain._id };
      }

      return { updateOne: { filter, update, upsert: true } };
    }));

    if (dryRun) { upserted += ops.length; continue; }

    const res = await Model.bulkWrite(ops as any[], { ordered: false });
    const up = (res.upsertedCount ?? 0) as number;
    upserted += up;
    inserted += up;
  }

  return { inserted, upserted };
}


/** Clear by raw collection name (for seeders without a clear() that uses a Model). */
export async function clearCollection(ctx: SeedContext, collectionName: string): Promise<void> {
  if (ctx.dryRun) {
    console.log(`[dry] Would clear collection "${collectionName}"`);
    return;
  }
  const res = await ctx.db.collection(collectionName).deleteMany({});
  console.log(`🧹 Cleared "${collectionName}" (deleted ${res.deletedCount ?? 0})`);
}
