// db/migrations/20250826073726-add-user-indexes.js
module.exports = {
  async up(db) {
    const users = db.collection("users");

    // create collection if it doesn't exist (safe)
    const exists = await db.listCollections({ name: "users" }).toArray();
    if (exists.length === 0) await db.createCollection("users");

    // fetch existing indexes once
    const idx = await users.indexes();
    const hasEmail = idx.some(i => i.name === "email_1");
    const hasUid   = idx.some(i => i.name === "uid_1");

    if (!hasEmail) {
      await users.createIndex({ email: 1 }, { name: "email_1", unique: true });
    }

    if (!hasUid) {
      // if it already exists with different options, we SKIP (non-destructive)
      await users.createIndex({ uid: 1 }, { name: "uid_1", sparse: true });
    }

    // Optional: collMod with JSON schema (safe to re-run)
    await db.command({
      collMod: "users",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { bsonType: "string" },
            email: { bsonType: "string" },
            password: { bsonType: "string", minLength: 6 },
            birthday: { bsonType: ["date", "null"] },
            phone: { bsonType: ["string", "null"] },
            role: { bsonType: "string", enum: ["consumer", "admin", "manager", "consumer"] },
            status: { bsonType: "bool" }
          }
        }
      },
      validationLevel: "moderate"
    }).catch(() => {}); // collMod is idempotent-ish; ignore if collection just created without data
  },

  async down(db) {
    const users = db.collection("users");
    const idx = await users.indexes();
    if (idx.some(i => i.name === "email_1")) {
      try { await users.dropIndex("email_1"); } catch {}
    }
    if (idx.some(i => i.name === "uid_1")) {
      try { await users.dropIndex("uid_1"); } catch {}
    }
    // Remove validator
    try {
      await db.command({ collMod: "users", validator: {}, validationLevel: "off" });
    } catch {}
  }
};
