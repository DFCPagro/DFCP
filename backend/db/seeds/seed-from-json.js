#!/usr/bin/env node
/**
 * Seed a MongoDB collection from a JSON file (array of documents).
 *
 * Usage examples (from project root or /backend):
 *   node seeds/seed-from-json.js --file ./exports/items.json --collection items --drop
 *   node seeds/seed-from-json.js --file ./exports/items.json --collection items --upsert
 *   node seeds/seed-from-json.js --file ./exports/items.json --collection items --upsert --objectId
 *
 * Env (.env):
 *   MONGODB_URI=mongodb+srv://user:pass@cluster.xxxx.mongodb.net/?retryWrites=true&w=majority
 *   MONGO_DB_NAME=dfcp   // optional; can also pass --db
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { MongoClient, ObjectId } = require("mongodb");

// ---- CLI args ----
const args = process.argv.slice(2);
function getFlag(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] ?? true : false;
}
const fileArg = getFlag("--file") || getFlag("-f");
const collArg = getFlag("--collection") || getFlag("-c");
const dbArg = getFlag("--db") || process.env.MONGO_DB_NAME;
const shouldDrop = !!getFlag("--drop");
const shouldUpsert = !!getFlag("--upsert");
const toObjectId = !!getFlag("--objectId"); // turn 24-hex string _id → ObjectId

if (!fileArg || !collArg) {
  console.error("Usage: node seeds/seed-from-json.js --file <path> --collection <name> [--db <name>] [--drop|--upsert] [--objectId]");
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI in .env");
  process.exit(1);
}

const jsonPath = path.resolve(fileArg);
if (!fs.existsSync(jsonPath)) {
  console.error(`File not found: ${jsonPath}`);
  process.exit(1);
}

function maybeObjectId(val) {
  return typeof val === "string" && /^[0-9a-fA-F]{24}$/.test(val) ? new ObjectId(val) : val;
}

(async () => {
  let client;
  try {
    // Load docs
    const raw = fs.readFileSync(jsonPath, "utf8");
    const docs = JSON.parse(raw);
    if (!Array.isArray(docs)) {
      throw new Error("JSON root must be an array of documents");
    }

    // Optional _id transform
    if (toObjectId) {
      for (const d of docs) {
        if (d && d._id) d._id = maybeObjectId(d._id);
      }
    }

    client = new MongoClient(MONGODB_URI);
    await client.connect();

    const dbName = dbArg || new URL(MONGODB_URI).pathname.replace(/^\//, "") || "test";
    const db = client.db(dbName);
    const col = db.collection(collArg);

    console.log(`→ Connected. DB: ${dbName} | Collection: ${collArg}`);
    console.log(`→ Docs to process: ${docs.length}`);

    if (shouldDrop) {
      try {
        await col.drop();
        console.log("✓ Dropped existing collection");
      } catch (e) {
        if (e.codeName === "NamespaceNotFound") {
          console.log("ℹ Collection did not exist, nothing to drop");
        } else {
          throw e;
        }
      }
    }

    if (shouldUpsert) {
      // Merge/replace by _id (required)
      const ops = docs.map((d) => {
        if (!("_id" in d)) {
          throw new Error("Upsert mode requires each document to have an _id");
        }
        return {
          replaceOne: {
            filter: { _id: d._id },
            replacement: d,
            upsert: true,
          },
        };
      });
      const res = await col.bulkWrite(ops, { ordered: false });
      console.log(
        `✓ Upserted: matched ${res.matchedCount}, modified ${res.modifiedCount}, upserts ${res.upsertedCount}`
      );
    } else {
      // Plain insertMany (will fail on dup _id)
      if (docs.length === 0) {
        console.log("ℹ Nothing to insert (empty array).");
      } else {
        const res = await col.insertMany(docs, { ordered: false });
        console.log(`✓ Inserted ${res.insertedCount} documents`);
      }
    }

    console.log("✅ Done.");
  } catch (err) {
    console.error("✗ Seed failed:", err.message || err);
    process.exit(1);
  } finally {
    if (client) await client.close().catch(() => {});
  }
})();
