import { connectDB, disconnectDB } from "../../src/db/connect";

async function resetDB() {``
  const conn = await connectDB();

  console.log(`⚠️ Dropping database: ${conn.name}...`);
  await conn.dropDatabase();

  console.log("✅ Database dropped.");
  await disconnectDB();
}

resetDB()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Reset failed:", err);
    process.exit(1);
  });
