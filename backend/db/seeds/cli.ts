#!/usr/bin/env node
// Unified seeding CLI entry point.

import path from "path";
import { Model } from "mongoose";
import { Command } from "commander";
import dotenv from "dotenv";
import { parseList, parsePairs } from "./utils/parse";
import discoverSeeders from "./utils/discovery";
import planRun from "./utils/graph";
import { withTimer, promptConfirm, printSummary, clearCollection } from "./utils/run";
import { connectDB, disconnectDB } from "../../src/db/connect";
import { IDMap } from "./utils/ids";
import { printHelp } from "./help";
import type { SeedMode, SeedContext, SeederModule } from "./types";

/* -------------------------------------------------------------------------- */
/* Paths                                                                      */
/* -------------------------------------------------------------------------- */

// Default globs resolved *relative to this file's folder* (db/seeds/)
const DEFAULT_SEEDERS = path.resolve(__dirname, "auto/*.seeder.{ts,js}");
const DEFAULT_DATA    = path.resolve(__dirname, "data/**/*.{json,ndjson}");

// Default .env lives at repo root (../../.env relative to db/seeds/cli.ts)
const DEFAULT_ENV = path.resolve(__dirname, "../../.env");

/* -------------------------------------------------------------------------- */
/* Small topo sort helper for fallback cases                                  */
/* -------------------------------------------------------------------------- */
function topoOrderFallback(mods: SeederModule[]): SeederModule[] {
  const nameToMod = new Map(mods.map(m => [m.descriptor.name, m] as const));
  const inDeg = new Map<string, number>();
  const graph = new Map<string, Set<string>>();

  for (const m of mods) {
    const n = m.descriptor.name;
    inDeg.set(n, 0);
    graph.set(n, new Set());
  }
  for (const m of mods) {
    const n = m.descriptor.name;
    for (const dep of (m.descriptor.dependsOn ?? [])) {
      if (!nameToMod.has(dep)) continue;
      graph.get(dep)!.add(n);
      inDeg.set(n, (inDeg.get(n) ?? 0) + 1);
    }
  }

  const q: string[] = [];
  for (const [n, deg] of inDeg) if (deg === 0) q.push(n);

  const out: SeederModule[] = [];
  while (q.length) {
    const n = q.shift()!;
    out.push(nameToMod.get(n)!);
    for (const nxt of graph.get(n)!) {
      inDeg.set(nxt, inDeg.get(nxt)! - 1);
      if (inDeg.get(nxt) === 0) q.push(nxt);
    }
  }
  return out.length === mods.length ? out : mods; // on cycle, keep discovery order
}

/* -------------------------------------------------------------------------- */
/* Bulk upsert helper                                                         */
/* -------------------------------------------------------------------------- */
/** Upsert docs through a **Mongoose Model** so validators/middleware run.
 *  IMPORTANT: never $set _id, to avoid Mongo "immutable _id" errors.
 */
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

    const ops = await Promise.all(chunk.map(async (doc) => {
      const m = new Model(doc);
      await m.validate();
      const plain = m.toObject({ depopulate: true });

      const { _id, ...settable } = plain; // never $set _id

      if (dryRun) {
        return { updateOne: { filter: makeFilter(plain), update: { $set: settable }, upsert: true } };
      }
      return {
        updateOne: {
          filter: makeFilter(plain),
          update: { $set: settable },
          upsert: true,
        }
      };
    }));

    if (dryRun) { upserted += ops.length; continue; }

    const res = await (Model as any).bulkWrite(ops as any[], { ordered: false });
    const up = (res.upsertedCount ?? 0) as number;
    upserted += up;
    inserted += up;
  }

  return { inserted, upserted };
}

/* -------------------------------------------------------------------------- */
/* Commander program                                                          */
/* -------------------------------------------------------------------------- */
const program = new Command();
program
  .name("seed")
  .description("Unified seeding CLI")
  .option("--env <file>", "Path to .env file", DEFAULT_ENV);

/* -------------------------------------------------------------------------- */
/* reset                                                                      */
/* -------------------------------------------------------------------------- */
program
  .command("reset")
  .description("Drop the entire database")
  .option("--dry-run", "Do not actually drop the database")
  .option("--yes", "Skip the confirmation prompt")
  .option("--env <file>", "Path to .env file")
  .action(async (opts: any) => {
    dotenv.config({ path: opts.env ?? DEFAULT_ENV });

    const dryRun = !!opts.dryRun;
    if (!dryRun && !opts.yes) {
      const ok = await promptConfirm("This will drop the entire database. Are you sure?");
      if (!ok) {
        console.log("Aborted.");
        return;
      }
    }

    const conn = await connectDB();
    console.log(`Connected to database ${conn.name}`);
    if (!dryRun) {
      await conn.dropDatabase();
      console.log(`Dropped database ${conn.name}`);
    } else {
      console.log(`[dry] Would drop database ${conn.name}`);
    }
    await disconnectDB();
  });

/* -------------------------------------------------------------------------- */
/* list                                                                       */
/* -------------------------------------------------------------------------- */
program
  .command("list")
  .description("List discovered seeders in dependency order")
  .argument("[patterns...]", "Seeder names or globs", (val) => val)
  .option("--json", "Output JSON instead of human readable list")
  .option("--deps", "Include dependencies in the output")
  .option("--verbose", "Include data paths and modes in the output")
  .option("--seeders <glob>", "Glob for seeder files", DEFAULT_SEEDERS)
  .option("--data <glob>", "Glob for data files", DEFAULT_DATA)
  .option("--env <file>", "Path to .env file")
  .action(async (patterns: string[], opts: any) => {
    dotenv.config({ path: opts.env ?? DEFAULT_ENV });

    const { modules, report } = await discoverSeeders(opts.seeders, opts.data);
    if (report.warnings?.length) for (const w of report.warnings) console.warn(w);

    const only = parseList(patterns);
    let { order, missing } = planRun(modules, only, []);

    // Fallback for --only when planner returns empty
    if (order.length === 0 && only.length > 0) {
      const toRe = (p: string) =>
        new RegExp("^" + p.replace(/[.+^${}()|[\\]\\\\]/g, "\\$&").replace(/\\\*/g, ".*") + "$", "i");
      const onlyRes = only.map(toRe);

      const matched = modules.filter((m) => {
        const name = m.descriptor?.name ?? "";
        return onlyRes.some((re) => re.test(name));
      });

      if (matched.length > 0) {
        console.warn(
          "⚠️  planner returned empty order; using direct name/glob fallback:",
          matched.map((m) => m.descriptor.name).join(", ")
        );
        order = topoOrderFallback(matched);
        missing = [];
      }
    }

    // Fallback for "all" (no patterns) when planner returns empty
    if (order.length === 0 && only.length === 0) {
      console.warn("⚠️  planner returned empty order for 'all'; using dependency order.");
      order = topoOrderFallback(modules);
      missing = [];
    }

    if (opts.json) {
      const out = order.map((m) => {
        const d = m.descriptor;
        const obj: any = { name: d.name, collection: d.collection };
        if (opts.deps) obj.dependsOn = d.dependsOn || [];
        if (opts.verbose) {
          obj.dataPaths = d.dataPaths || [];
          obj.hasStatic = !!d.hasStatic;
          obj.hasFaker = !!d.hasFaker;
        }
        return obj;
      });
      console.log(JSON.stringify(out, null, 2));
      return;
    }

    if (order.length === 0) {
      console.log("No seeders found.");
      return;
    }

    for (const m of order) {
      const d = m.descriptor;
      let line = `• ${d.name}`;
      if (opts.deps && d.dependsOn?.length) line += ` (depends on ${d.dependsOn.join(", ")})`;
      console.log(line);
      if (opts.verbose) {
        if (d.dataPaths?.length) console.log(`   data: ${d.dataPaths.join(", ")}`);
        const modes = [d.hasStatic ? "static" : null, d.hasFaker ? "faker" : null]
          .filter(Boolean)
          .join(", ") || "none";
        console.log(`   modes: ${modes}`);
      }
    }

    if (missing.length) {
      console.warn(`⚠️  Missing dependencies: ${missing.join(", ")}. Seeders that reference them may fail.`);
    }
  });

/* -------------------------------------------------------------------------- */
/* seed                                                                       */
/* -------------------------------------------------------------------------- */
program
  .command("seed")
  .description("Run the seeding process")
  .option("--only <list>", "Comma/space separated list of seeders to include")
  .option("--except <list>", "Comma/space separated list of seeders to exclude")
  .option("--mode <mode>", "Seeding mode: static, faker or both", "both")
  .option("--fresh", "Drop targeted collections before seeding")
  .option("--append", "Do not delete existing documents (implies no clear)")
  .option("--dry-run", "Print actions without making changes")
  .option("--yes", "Skip confirmation prompts for destructive actions")
  .option("--count <pairs>", "Number of faker docs per seeder", "")
  .option("--top-up <pairs>", "Number of additional docs per seeder", "")
  .option("--upsert-on <pairs>", "Upsert keys per seeder", "")
  .option("--batch-size <n>", "Bulk operation batch size", (v) => Number(v), 500)
  .option("--concurrency <n>", "Parallel operations (reserved)", (v) => Number(v), 4)
  .option("--strict", "Fail on invalid JSON instead of warning", false)
  .option("--seeders <glob>", "Glob for seeder files", DEFAULT_SEEDERS)
  .option("--data <glob>", "Glob for data files", DEFAULT_DATA)
  .option("--env <file>", "Path to .env file")
  .action(async (opts: any) => {
    dotenv.config({ path: opts.env ?? DEFAULT_ENV });

    const only = parseList(opts.only);
    const except = parseList(opts.except);
    const mode: SeedMode = (opts.mode || "both").toLowerCase() as SeedMode;
    const fresh: boolean = !!opts.fresh;
    const append: boolean = !!opts.append;
    const dryRun: boolean = !!opts.dryRun;
    const strict: boolean = !!opts.strict;

    if (!dryRun && fresh && !opts.yes) {
      const ok = await promptConfirm("This will drop targeted collections before seeding. Continue?");
      if (!ok) {
        console.log("Aborted.");
        return;
      }
    }

    const counts = parsePairs(opts.count, false);
    const topUp = parsePairs(opts["top-up"], false);
    const upsertOn = parsePairs(opts["upsert-on"], true);

    const { modules, report } = await discoverSeeders(opts.seeders, opts.data);
    if (report.warnings?.length) for (const w of report.warnings) console.warn(w);

    let { order, missing } = planRun(modules, only, except);

    // Fallback for --only when planner returns empty
    if (order.length === 0 && only.length > 0) {
      const toRe = (p: string) =>
        new RegExp("^" + p.replace(/[.+^${}()|[\\]\\\\]/g, "\\$&").replace(/\\\*/g, ".*") + "$", "i");
      const onlyRes = only.map(toRe);
      const exceptRes = except.map(toRe);

      const matched = modules.filter((m) => {
        const name = m.descriptor?.name ?? "";
        const inOnly = onlyRes.length === 0 || onlyRes.some((re) => re.test(name));
        const inExcept = exceptRes.some((re) => re.test(name));
        return inOnly && !inExcept;
      });

      if (matched.length > 0) {
        console.warn(
          "⚠️  planner returned empty order; using direct name/glob fallback:",
          matched.map((m) => m.descriptor.name).join(", ")
        );
        order = topoOrderFallback(matched);
        missing = [];
      }
    }

    // Fallback for "all" (no --only) when planner returns empty
    if (order.length === 0 && only.length === 0) {
      console.warn("⚠️  planner returned empty order for 'all'; running in dependency order.");
      order = topoOrderFallback(modules);
      missing = [];
    }

    if (order.length === 0) {
      console.log("Nothing to seed.");
      return;
    }

    if (missing.length) {
      console.warn(`⚠️  Missing dependencies: ${missing.join(", ")}. Seeders that reference them may fail.`);
    }

    const db = await connectDB();
    console.log(`Connected to database ${db.name}`);

    const ctx: SeedContext = {
      db,
      dryRun,
      batchSize: Number(opts.batchSize) || 500,
      concurrency: Number(opts.concurrency) || 4,
      mode,
      flags: { fresh, append, strict },
      counts,
      topUp,
      upsertOn,
      idMap: new IDMap(),
      log: (...args: any[]) => console.log(...args),
    };

    const results: Array<{ name: string; inserted: number; upserted: number; ms: number }> = [];

    for (const mod of order) {
      const name = mod.descriptor.name;
      const doFresh = fresh && !append;

      try {
        // Clear (prefer seeder.clear)
        if (doFresh) {
          await withTimer(`clear ${name}`, async () => {
            if (typeof mod.clear === "function") {
              await mod.clear!(ctx);
            } else {
              await clearCollection(ctx, mod.descriptor.collection);
            }
          });
        }

        let inserted = 0;
        let upserted = 0;
        let totalMs = 0;

        // Static
        if (mode === "static" || mode === "both") {
          if (mod.seedStatic) {
            const { result, ms } = await withTimer(`${name} (static)`, async () => {
              return await mod.seedStatic!(ctx);
            });
            inserted += result?.inserted || 0;
            upserted += result?.upserted || 0;
            totalMs += ms;
          } else if (mode === "static") {
            ctx.log(`⚠️  ${name} does not implement static seeding; skipped.`);
          }
        }

        // Faker
        if (mode === "faker" || mode === "both") {
          let count = 0;
          const key = name.toLowerCase();
          if (ctx.counts["*"] != null) count = ctx.counts["*"];
          if (ctx.counts[key] != null) count = ctx.counts[key];
          if (ctx.topUp["*"] != null) count += ctx.topUp["*"];
          if (ctx.topUp[key] != null) count += ctx.topUp[key];

          if (count > 0 && mod.seedFaker) {
            const { result, ms } = await withTimer(`${name} (faker ${count})`, async () => {
              return await mod.seedFaker!(ctx, count);
            });
            inserted += result?.inserted || 0;
            upserted += result?.upserted || 0;
            totalMs += ms;
          } else if (count > 0 && !mod.seedFaker) {
            ctx.log(`⚠️  ${name} does not implement faker seeding; skipped.`);
          }
        }

        results.push({ name, inserted, upserted, ms: totalMs });
      } catch (err) {
        console.warn(`[${name}] failed:`, err);
        results.push({ name, inserted: 0, upserted: 0, ms: 0 });
        continue;
      }
    }

    await disconnectDB();
    printSummary(results);
  });

/* -------------------------------------------------------------------------- */
/* help                                                                       */
/* -------------------------------------------------------------------------- */
program
  .command("help")
  .description("Show extended help text")
  .action(() => {
    printHelp();
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
