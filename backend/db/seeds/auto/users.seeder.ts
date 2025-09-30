// seeds/modules/users.seeder.ts
import path from "path";
import type { SeederModule, SeedContext, SeederDescriptor } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";
import User from "../../../src/models/user.model";
import Farmer from "../../../src/models/farmer.model"; // ⬅️ add
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import mongoose from "mongoose"; // ⬅️ add

const DATA = path.resolve(__dirname, "../data/users.data.json");

const descriptor: SeederDescriptor = {
  name: "users",
  collection: User.collection.name,
  dependsOn: [],
  dataPaths: [DATA],
  upsertOn: ["email"],
  hasStatic: true,
  hasFaker: true,
};

// ---------- helpers ----------
function isBcryptHash(p?: unknown): p is string {
  return typeof p === "string" && p.startsWith("$2");
}

async function hashIfNeeded(pwd: unknown): Promise<string | undefined> {
  if (pwd == null) return undefined;
  if (isBcryptHash(pwd)) return pwd as string;
  if (typeof pwd !== "string") throw new Error("Password must be a string");
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pwd, salt);
}

function normalizeEmail(email: unknown): string | undefined {
  if (typeof email !== "string") return undefined;
  return email.trim().toLowerCase();
}

/** Prepare docs for upsert: normalize email, hash password if needed. */
async function prepareUsers(docs: any[]) {
  return Promise.all(
    docs.map(async (d) => {
      const email = normalizeEmail(d.email) ?? d.email;
      const password = await hashIfNeeded(d.password);
      const out: any = { ...d, email };

      // Only set password if it exists in input; avoid overwriting existing with undefined
      if (password != null) out.password = password;

      // Optional: ensure timestamps exist (some runners rely on them)
      if (!out.createdAt) out.createdAt = new Date();
      out.updatedAt = new Date();

      return out;
    })
  );
}

/** Build a Farmer payload from a user row (supports embedded `farmer` or defaults). */
function buildFarmerFromUser(userDoc: any, userId: mongoose.Types.ObjectId) {
  const f = userDoc.farmer || {};

  const nameForFarm =
    (userDoc.name && String(userDoc.name).split(" ")[0]) ||
    "Green";

  const farmName = f.farmName || `${nameForFarm} Family Farm`;

  const farmerInfo =
    f.farmerInfo ||
    "Family-run, climate-smart farm prioritizing soil health, water efficiency, and biodiversity. We use drip irrigation, cover crops, and minimal tillage.";

  const farmLogo =
    f.farmLogo ||
    `https://picsum.photos/seed/${userId.toString().slice(-6)}/512/512`;

  const agriculturalInsurance =
    typeof f.agriculturalInsurance === "boolean" ? f.agriculturalInsurance : false;

  const agreementPercentage =
    typeof f.agreementPercentage === "number" ? f.agreementPercentage : 60;

  // ---- NEW: ensure lands is NON-EMPTY for seeding to satisfy the validator ----
  const inputLands = Array.isArray(f.lands) ? f.lands.filter(Boolean) : [];
  let lands = inputLands;
  if (lands.length === 0) {
    // Use a stable dummy id if provided, else generate one
    const envDummy = process.env.SEED_DUMMY_LAND_ID;
    const dummy =
      envDummy && mongoose.isValidObjectId(envDummy)
        ? new mongoose.Types.ObjectId(envDummy)
        : new mongoose.Types.ObjectId(); // placeholder, replace later
    lands = [dummy];
  }
  // ---------------------------------------------------------------------------

  return {
    user: userId,
    farmName,
    farmerInfo,
    farmLogo,
    agriculturalInsurance,
    agreementPercentage,
    lands,
    createdAt: f.createdAt ?? new Date(),
    updatedAt: new Date(),
  };
}


/** Upsert Farmer docs for the given user input rows (matched by email). */
async function upsertFarmersForUsers(userInputRows: any[], batchSize: number, dryRun: boolean) {
  const emails = userInputRows
    .map((u) => normalizeEmail(u.email) ?? u.email)
    .filter(Boolean);

  if (!emails.length) return;

  const dbUsers = await User.find({ email: { $in: emails } })
    .select("_id email role name")
    .lean();

  const emailToUser = new Map(dbUsers.map((u: any) => [u.email, u]));

  const farmerPayloads: any[] = [];
  for (const raw of userInputRows) {
    const email = normalizeEmail(raw.email) ?? raw.email;
    const dbUser = emailToUser.get(email);
    if (!dbUser) continue;
    if (dbUser.role !== "farmer") continue;

    const payload = buildFarmerFromUser(raw, dbUser._id);
    farmerPayloads.push(payload);
  }

  if (!farmerPayloads.length) return;

  // Upsert on "user" so each User has at most one Farmer profile
  await bulkUpsertModel(Farmer as any, farmerPayloads, ["user"], batchSize, dryRun);
}

// ---------- seeding ----------
async function seedStatic(ctx: SeedContext) {
  let docs: any[] = await loadJSON(descriptor.dataPaths![0], { strict: ctx.flags.strict });
  if (!Array.isArray(docs)) docs = [docs];

  const prepped = await prepareUsers(docs);
  const res = await bulkUpsertModel(User as any, prepped, descriptor.upsertOn!, ctx.batchSize, ctx.dryRun);

  // Also upsert Farmer profiles for farmer users
  if (!ctx.dryRun) {
    // If your FarmerSchema enforces non-empty lands, run with:
    // ALLOW_EMPTY_FARMER_LANDS=true
    await upsertFarmersForUsers(docs, ctx.batchSize, ctx.dryRun);
  }

  return res;
}

async function seedFaker(ctx: SeedContext, count: number) {
  // read allowed roles off the schema enum (matches your model)
  const rolePath: any = User.schema.path("role");
  const enumValues: string[] = rolePath?.options?.enum || rolePath?.enumValues || [];
  const pickRole = () => (enumValues.length ? faker.helpers.arrayElement(enumValues) : undefined);

  const raw = Array.from({ length: count }).map(() => {
    const plain = faker.internet.password({ length: 12 });
    const role = pickRole();

    // Optionally include `farmer` object only when role === "farmer"
    const farmer =
      role === "farmer"
        ? {
            farmName: `${faker.helpers.arrayElement(["Sunrise", "Cedar", "Olive", "Hilltop", "Carmel"])} Farm`,
            agriculturalInsurance: faker.datatype.boolean(),
            agreementPercentage: faker.number.int({ min: 50, max: 80 }),
            farmLogo: `https://picsum.photos/seed/${faker.string.alphanumeric(6)}/512/512`,
            farmerInfo:
              faker.helpers.arrayElement([
                "Regenerative practices with cover cropping and compost.",
                "Solar-powered irrigation and water harvesting.",
                "CSA with weekly harvest boxes for the community.",
                "Orchards with beneficial insect habitats and zero till.",
              ]) + " " + faker.lorem.sentence(),
            lands: [], // keep empty during seed unless you also seed FarmerLand
          }
        : undefined;

    return {
      uid: faker.string.uuid(),
      email: faker.internet.email().toLowerCase(),
      name: faker.person.fullName(),
      password: plain, // will be hashed by prepareUsers()
      role,
      phone: faker.phone.number(),
      farmer, // may be undefined
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  const prepped = await prepareUsers(raw);
  const res = await bulkUpsertModel(User as any, prepped, ["email"], ctx.batchSize, ctx.dryRun);

  if (!ctx.dryRun) {
    await upsertFarmersForUsers(raw, ctx.batchSize, ctx.dryRun);
  }

  return res;
}

async function clear(ctx: SeedContext) {
  // clear users only; if you also want to clear farmers here, you can, but keeping it scoped:
  return clearModel(ctx, User as any);
}

const seeder: SeederModule = { descriptor, seedStatic, seedFaker, clear };
export default seeder;
