import path from "path";
import type { SeederModule, SeedContext, SeederDescriptor } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";
import User from "../../../src/models/user.model";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";

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

// ---------- seeding ----------
async function seedStatic(ctx: SeedContext) {
  let docs: any[] = await loadJSON(descriptor.dataPaths![0], { strict: ctx.flags.strict });
  if (!Array.isArray(docs)) docs = [docs];

  const prepped = await prepareUsers(docs);
  return bulkUpsertModel(User as any, prepped, descriptor.upsertOn!, ctx.batchSize, ctx.dryRun);
}

async function seedFaker(ctx: SeedContext, count: number) {
  // read allowed roles off the schema enum (matches your model)
  const rolePath: any = User.schema.path("role");
  const enumValues: string[] = rolePath?.options?.enum || rolePath?.enumValues || [];
  const pickRole = () => (enumValues.length ? faker.helpers.arrayElement(enumValues) : undefined);

  const raw = Array.from({ length: count }).map(() => {
    const plain = faker.internet.password({ length: 12 });
    return {
      uid: faker.string.uuid(),
      email: faker.internet.email().toLowerCase(),
      name: faker.person.fullName(),
      password: plain, // will be hashed by prepareUsers()
      role: pickRole(),
      phone: faker.phone.number(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  const prepped = await prepareUsers(raw);
  return bulkUpsertModel(User as any, prepped, ["email"], ctx.batchSize, ctx.dryRun);
}

async function clear(ctx: SeedContext) {
  return clearModel(ctx, User as any);
}

const seeder: SeederModule = { descriptor, seedStatic, seedFaker, clear };
export default seeder;
