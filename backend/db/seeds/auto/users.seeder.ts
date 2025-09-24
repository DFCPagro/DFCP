import path from "path";
import type { SeederModule, SeedContext, SeederDescriptor } from "../types";
import { loadJSON } from "../utils/io";
import { bulkUpsertModel, clearModel } from "../utils/run";
import User from "../../../src/models/user.model";
import { faker } from "@faker-js/faker";

const DATA = path.resolve(__dirname, "../data/users.data.json");


const descriptor: SeederDescriptor = {
  name: "users",
  collection: User.collection.name,
  dependsOn: [],
  dataPaths: [DATA],
  upsertOn: ["email"],
  hasStatic: true,
  hasFaker: true, // ✅ enable faker
};

async function seedStatic(ctx: SeedContext) {
  let docs: any[] = await loadJSON(descriptor.dataPaths![0], { strict: ctx.flags.strict });
  if (!Array.isArray(docs)) docs = [docs];
  return bulkUpsertModel(User as any, docs, descriptor.upsertOn!, ctx.batchSize, ctx.dryRun);
}

async function seedFaker(ctx: SeedContext, count: number) {
  // Read allowed roles off the schema, so we never violate your enum.
  const rolePath: any = User.schema.path("role");
  const enumValues: string[] =
    rolePath?.options?.enum || rolePath?.enumValues || []; // mongoose exposes one of these

  const pickRole = () => (enumValues.length ? faker.helpers.arrayElement(enumValues) : undefined);

  // If your schema also requires other fields (e.g. `uid`, `phone`), add them here.
  const docs = Array.from({ length: count }).map(() => {
    const password = faker.internet.password({ length: 12 }); // satisfies "required"
    return {
      uid: faker.string.uuid(),                 // harmless, often present in your project
      email: faker.internet.email().toLowerCase(),
      name: faker.person.fullName(),
      password,                                 // ⚠️ bulkWrite won’t run pre-save hooks; stored as-is
      role: pickRole(),                         // ✅ guaranteed to be valid for your enum
      phone: faker.phone.number(), // tweak mask to your locale if needed
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });

  return bulkUpsertModel(User as any, docs, ["email"], ctx.batchSize, ctx.dryRun);
}

async function clear(ctx: SeedContext) {
  return clearModel(ctx, User as any);
}

const seeder: SeederModule = { descriptor, seedStatic, seedFaker, clear };
export default seeder;
