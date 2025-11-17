// db/seeds/auto/job-applications.seeder.ts
import path from "path";
import type { SeederModule, SeederDescriptor, SeedContext } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";

import { Types } from "mongoose";
import JobApplication from "../../../src/models/jobApplication.model";

const DATA = path.resolve(__dirname, "../data/jobApplications.data.json");

const descriptor: SeederDescriptor = {
  name: "job-applications",
  collection: JobApplication.collection.name,
  dependsOn: ["users", "logistics-centers"],
  dataPaths: [DATA],
  upsertOn: ["user", "appliedRole"], // static: 1 doc per (user, role)
  hasStatic: true,
  hasFaker: false,
};

// ───────────────── helpers ─────────────────

const isHex24 = (v: any): v is string =>
  typeof v === "string" && /^[0-9a-f]{24}$/i.test(v);

const toObjectIdOrThrow = (v: any, ctxLabel: string): Types.ObjectId => {
  const str = String(v);
  if (!isHex24(str)) {
    throw new Error(
      `job-applications.seeder: invalid ObjectId for ${ctxLabel}: "${str}"`
    );
  }
  return new Types.ObjectId(str);
};

// ───────────────── seeding ─────────────────

async function seedStatic(ctx: SeedContext) {
  let rows: any[] = await loadJSON(descriptor.dataPaths![0], {
    strict: ctx.flags.strict,
  });

  if (!Array.isArray(rows)) rows = [rows];

  const docs: any[] = [];
  const now = new Date();

  rows.forEach((raw, index) => {
    try {
      if (!raw.user) {
        throw new Error("missing `user` field");
      }
      if (!raw.appliedRole) {
        throw new Error("missing `appliedRole` field");
      }
      if (!raw.logisticCenterId) {
        throw new Error("missing `logisticCenterId` field");
      }

      const userId = toObjectIdOrThrow(raw.user, `user (row #${index})`);
      const logisticCenterId = toObjectIdOrThrow(
        raw.logisticCenterId,
        `logisticCenterId (row #${index})`
      );

      const appliedRole = String(raw.appliedRole).trim();
      const status = (raw.status as string) ?? "pending";

      const applicationData =
        raw.applicationData && typeof raw.applicationData === "object"
          ? raw.applicationData
          : {};

      const doc: any = {
        user: userId,
        appliedRole,
        logisticCenterId,
        status,
        applicationData,
        createdAt: now,
        updatedAt: now,
      };

      if (raw._id && isHex24(raw._id)) {
        doc._id = new Types.ObjectId(raw._id);
      }

      docs.push(doc);
    } catch (err: any) {
      ctx.log?.(
        `[job-applications] skipping row #${index}: ${
          err?.message ?? String(err)
        }`
      );
    }
  });

  if (docs.length === 0) {
    ctx.log?.("[job-applications] no valid rows after normalization.");
    return { inserted: 0, upserted: 0 };
  }

  const keys = ctx.upsertOn[descriptor.name] ??
    descriptor.upsertOn ?? ["user", "appliedRole"];

  return bulkUpsertModel(
    JobApplication as any,
    docs,
    keys,
    ctx.batchSize,
    ctx.dryRun
  );
}

async function clear(ctx: SeedContext) {
  return clearModel(ctx, JobApplication as any);
}

const seeder: SeederModule = { descriptor, seedStatic, clear };
export default seeder;
