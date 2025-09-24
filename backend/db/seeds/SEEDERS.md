---

# 🌱 Unified Seeder Framework – README

This document explains the **database seeding system** used in this project. It covers **file structure**, **CLI commands**, **configuration**, and **examples** of how to run the seeding process in different modes.

---

## 📂 File Structure

The seeding framework lives inside the `db/seeds/` folder. It’s organized as follows:

```
db/
└── seeds/
    ├── auto/               # All actual seeder files (*.seeder.ts)
    │   ├── users.seeder.ts
    │   ├── items.seeder.ts
    │   ├── deliverers.seeder.ts
    │   └── ...
    ├── data/               # JSON/NDJSON static seed data
    │   ├── users.data.json
    │   ├── items.data.json
    │   ├── deliverers.data.json
    │   └── ...
    ├── cli.ts              # Main entrypoint for the seeding CLI
    ├── types.ts            # Shared types for Seeders
    ├── utils/              # Helper utilities
    │   ├── io.ts           # File loading/parsing (JSON, NDJSON)
    │   ├── run.ts          # Bulk upsert, timers, clearing
    │   ├── ids.ts          # IDMap for relation resolution
    │   └── discovery.ts    # Finds all seeders dynamically
```

* **`auto/*.seeder.ts`** – Each seeder corresponds to one MongoDB collection (e.g., `users`, `items`, `deliverers`).
* **`data/*.json`** – Static data files consumed by seeders when `--mode static` or `--mode both`.
* **`cli.ts`** – A `commander`-based CLI that discovers seeders, orders them, and runs them.
* **`types.ts`** – Type definitions for `SeedContext`, `SeederModule`, etc.
* **`utils/`** – Core utilities for I/O, bulk writes, ID mapping, etc.

---

## ⚙️ Seeder Contract

Every seeder exports a `SeederModule` object with:

```ts
export interface SeederModule {
  descriptor: SeederDescriptor;  // Metadata
  clear?: (ctx: SeedContext) => Promise<void>;
  seedStatic?: (ctx: SeedContext) => Promise<Result>;
  seedFaker?: (ctx: SeedContext, count: number) => Promise<Result>;
}
```

Where:

* **`descriptor`** – describes the seeder (collection name, dependencies, data paths, modes).
* **`clear`** – deletes/clears the collection (called when `--fresh` is used).
* **`seedStatic`** – loads static JSON files.
* **`seedFaker`** – generates fake documents when faker mode is active.

---

## 🧾 Seeder Descriptor Example

```ts
const descriptor: SeederDescriptor = {
  name: "items",
  collection: Item.collection.name,
  dependsOn: [], // optional: ["users", "package-sizes"]
  dataPaths: [path.resolve(__dirname, "../data/items.data.json")],
  upsertOn: ["_id"], // unique keys used for upsert
  hasStatic: true,   // this seeder supports static data
  hasFaker: true,    // this seeder also supports faker
};
```

---

## 🛠️ CLI Commands

The CLI is run via `npm scripts` or directly with `npx tsx`.

### 🔄 Reset the entire database

Drops the current MongoDB database.

```bash
npm run db:reset
```

Equivalent raw command:

```bash
npx tsx db/seeds/cli.ts reset --yes
```

---

### 🌱 Seed with **static data only**

```bash
npm run db:seed:static
```

Equivalent raw command:

```bash
npx tsx db/seeds/cli.ts seed --mode static --fresh --yes
```

---

### 🤖 Seed with **faker only**

```bash
npm run db:seed:faker
```

Equivalent raw command (with counts):

```bash
npx tsx db/seeds/cli.ts seed --mode faker --count "users=10,items=20" --yes
```

---

### 🔀 Seed with **both static + faker**

1. Loads static JSON files.
2. Then generates additional faker records.

```bash
npm run db:seed:both
```

Equivalent raw command:

```bash
npx tsx db/seeds/cli.ts seed --mode both --count "users=5" --yes
```

---

### 🎯 Seed a subset of collections

```bash
npm run db:seed:subset
```

Equivalent raw command:

```bash
npx tsx db/seeds/cli.ts seed --mode static --fresh --only "package-sizes,items,users" --yes
```

---

### 🧹 Reset + Static in one go

```bash
npm run db:rebuild:static
```

Equivalent raw command:

```bash
npx tsx db/seeds/cli.ts reset --yes && npx tsx db/seeds/cli.ts seed --mode static --fresh --yes
```

---

## 🎛️ Modes Explained

* **`static`** → Uses only `.json` files from `db/seeds/data/`.
* **`faker`** → Ignores JSON, generates fake data in memory.
* **`both`** → Runs `static` first, then `faker`.

The mode is controlled by `--mode` or the `npm` scripts.

---

## 🗂 Example Seeder with Faker

```ts
import { faker } from "@faker-js/faker";
import Item from "../../../src/models/Item.model";

async function seedFaker(ctx: SeedContext, count: number) {
  const docs: any[] = [];

  for (let i = 0; i < count; i++) {
    docs.push({
      _id: new mongoose.Types.ObjectId(),
      name: faker.commerce.productName(),
      type: faker.commerce.department(),
      variety: faker.commerce.productMaterial(),
      price: faker.number.float({ min: 1, max: 100 }),
    });
  }

  const keys = ctx.upsertOn["items"] ?? ["_id"];
  return bulkUpsertModel(Item, docs, keys, ctx.batchSize, ctx.dryRun);
}
```

---

## 📊 Example Run Summary

When you run seeding, you’ll see a table like this:

```
Summary
seeder             inserted  upserted  ms
-----------------------------------------
users              14        14        154
items              10        10        299
package-sizes      3         3         427
deliverers         2         2         512
-----------------------------------------
TOTAL              29        29        1392
```

* **inserted** – new docs added.
* **upserted** – updated existing docs (matched by `upsertOn`).
* **ms** – time taken per seeder.

---

## 🧰 Common Options

* `--fresh` → Drops targeted collections before seeding.
* `--append` → Adds new docs but doesn’t delete old ones.
* `--count "users=10"` → Faker counts per seeder.
* `--top-up "items=5"` → Add on top of existing docs.
* `--upsert-on "items=sku"` → Override unique keys per seeder.
* `--strict` → Fail hard on invalid JSON rows.

---

## 🛑 Troubleshooting

* **Duplicate index warnings**
  Happens when Mongoose schema defines `index: true` **and** also calls `schema.index()`.
  ✅ Fix: remove one of the duplicates in your model.

* **Validation errors**
  Example:

  ```
  Deliverer validation failed: licenseType: Path `licenseType` is required.
  ```

  ✅ Fix: Ensure your seeder provides required fields (or add sensible defaults).

* **No seeders matched**
  Check your glob patterns:

  ```
  --seeders db/seeds/auto/*.seeder.{ts,js}
  ```

---

## 💡 Best Practices

* Always run `npm run db:reset` before seeding to ensure a clean state.
* Keep `db/seeds/data/*.json` under version control for reproducibility.
* Use faker for **development only** — production should stick to static.
* Explicitly set `upsertOn` keys to avoid duplications.
* If your seeder depends on others (e.g., `deliverers` depends on `users`), always declare `dependsOn`.

---
