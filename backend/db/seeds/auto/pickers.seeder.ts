import path from "path";
import mongoose from "mongoose";
import type { SeederModule, SeedContext, SeederDescriptor } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";

import { recomputeLevel } from "../../../src/utils/level";
import Picker from "../../../src/models/picker.model";
import User from "../../../src/models/user.model";

const DATA = path.resolve(__dirname, "../data/pickers.data.json");

const descriptor: SeederDescriptor = {
  name: "pickers",
  collection: Picker.collection.name,
  dependsOn: ["users", "logistics-centers"], // users carry LC; make sure LCs exist
  dataPaths: [DATA],
  upsertOn: ["userId"],
  hasStatic: true,
  hasFaker: false,
};

type RawPickerRow = {
  _id?: string;
  userId: string;
  nickname?: string;
  status?: "active" | "suspended" | "unactive";
  xp?: number;
};

const OID = (v: string | mongoose.Types.ObjectId) =>
  typeof v === "string" ? new mongoose.Types.ObjectId(v) : v;

function normalizeUpsertResult(res: any): { inserted: number; upserted: number } {
  if (!res) return { inserted: 0, upserted: 0 };
  const inserted = typeof res.inserted === "number" ? res.inserted : 0;
  const upserted =
    typeof res.upserted === "number"
      ? res.upserted
      : typeof res.modified === "number"
        ? res.modified
        : 0;
  return { inserted, upserted };
}

async function preparePickers(docs: RawPickerRow[]) {
  const out: any[] = [];
  if (!docs?.length) return out;

  const userIds = Array.from(new Set(docs.map((d) => d.userId))).filter(Boolean);
  const users = await User.find({ _id: { $in: userIds } })
    .select("_id role logisticCenterId name")
    .lean();
  const mapUser = new Map(users.map((u: any) => [u._id.toString(), u]));

  for (const d of docs) {
    if (!d.userId) throw new Error("picker row missing userId");
    const user =
      mapUser.get(d.userId) ||
      (await User.findById(d.userId).select("_id role logisticCenterId name").lean());

    if (!user) throw new Error(`User not found for picker userId=${d.userId}`);
    if (user.role !== "picker") {
      throw new Error(`User ${d.userId} is not role "picker" (found "${user.role}")`);
    }

    // Optional: warn if user lacks LC assignment
    if (!user.logisticCenterId) {
      console.warn(
        `[pickers] user ${d.userId} has no logisticCenterId — picker will seed, but LC-dependent views may be empty.`
      );
    }

    const xp = Number.isFinite(d.xp as number) ? Math.max(0, d.xp as number) : 0;
    const level = recomputeLevel(xp);

    out.push({
      ...(d._id ? { _id: OID(d._id) } : {}),
      userId: OID(d.userId),
      nickname: (d.nickname ?? "").trim(),
      status: d.status ?? "active",
      gamification: { xp, level },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return out;
}

async function seedStatic(ctx: SeedContext) {
  const loaded = await loadJSON(DATA, { strict: ctx.flags.strict });
  const raws: RawPickerRow[] = Array.isArray(loaded) ? loaded : [loaded];

  const preparedStatic = await preparePickers(raws);

  // Also synthesize for any picker users not covered by static file
  const staticUserIds = new Set(raws.map((r) => r.userId));
  const restUsers = await User.find({
    role: "picker",
    _id: { $nin: Array.from(staticUserIds).map((id) => OID(id)) },
  })
    .select("_id logisticCenterId name")
    .lean();

  const missingRaw: RawPickerRow[] = restUsers.map((u: any) => ({
    userId: u._id.toString(),
    nickname: (u.name ? String(u.name).split(" ")[0] : "Picker"),
    xp: 0,
    status: "active",
  }));

  const preparedMissing = await preparePickers(missingRaw);
  const payload = [...preparedStatic, ...preparedMissing];

  if (!payload.length) return { inserted: 0, upserted: 0 };

  const res = await bulkUpsertModel(
    Picker as any,
    payload,
    descriptor.upsertOn!,
    ctx.batchSize,
    ctx.dryRun
  );

  return normalizeUpsertResult(res);
}

async function clear(ctx: SeedContext) {
  return clearModel(ctx, Picker as any);
}

const seeder: SeederModule = { descriptor, seedStatic, clear };
export default seeder;
