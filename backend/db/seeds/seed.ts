import "dotenv/config";
import minimist from "minimist";
import { connectDB, disconnectDB } from "../../src/db/connect";

// existing seeders
import { seedUsers } from "./dev/users.seeder";
import { seedItems } from "./dev/items.seeder";
import { seedLogisticsCenters } from "./dev/logisticCenters.seeder";
import seedAppConfig from "./dev/seedAppConfig";
import seedAvailableMarketStock from "./dev/seedAvailableMarketStock";
import { seedDeliverers } from "./dev/deliverers.seeder";
// import { seedOrders } from './dev/orders.seeder'
import { seedShiftsConfig } from "./dev/shiftConfig.seeder";

// NEW: packing + package sizes
import { seedItemPacking } from "./dev/seedItemPacking.seeder";
import { seedPackageSizes } from "./dev/seedPackageSizes.seeder";

type Args = {
  reset?: boolean;
  env?: string;
  orders?: number;
  "no-users"?: boolean;
  "no-orders"?: boolean;
  /** Skip aggregation seeding */
  "no-aggregations"?: boolean;
  /** Skip container seeding */
  "no-containers"?: boolean;
  /** Skip shipment seeding */
  "no-shipments"?: boolean;

  // NEW flags
  "no-package-sizes"?: boolean;
  "no-item-packing"?: boolean;

  // existing (implicit) flags referenced below
  "no-items"?: boolean;
  "no-logistic-centers"?: boolean;
  "no-deliverers"?: boolean;
  "no-shifts"?: boolean;
  "no-available-stock"?: boolean;
  "no-config"?: boolean;
};

async function main() {
  const argv = minimist<Args>(process.argv.slice(2), {
    boolean: [
      "reset",
      "no-users",
      "no-orders",
      "no-aggregations",
      "no-containers",
      "no-shipments",
      "no-items",
      "no-logistic-centers",
      "no-deliverers",
      "no-shifts",
      "no-available-stock",
      "no-config",
      // NEW
      "no-package-sizes",
      "no-item-packing",
    ],
    string: ["env"],
    default: { orders: 15 },
    alias: { r: "reset" },
  });

  console.log("🌱 Seed orchestrator starting…");
  console.log("   flags:", argv);

  const conn = await connectDB();
  console.log(`🔌 Connected to ${conn.name}`);

  if (argv.reset) {
    console.log(`⚠️ Dropping database: ${conn.name}…`);
    await conn.dropDatabase();
    console.log("✅ Database dropped");
  }

  // Users first (unless disabled)
  if (!argv["no-users"]) {
    await timed("Users", seedUsers);
  } else {
    console.log("⏭️  Skipping users seeding");
  }

  // Items
  if (!argv["no-items"]) {
    await timed("Items", seedItems);
  } else {
    console.log("⏭️  Skipping items seeding");
  }

  // Logistics Centers
  if (!argv["no-logistic-centers"]) {
    await timed("logistic-center", seedLogisticsCenters);
  } else {
    console.log("⏭️  Skipping logistic-centers seeding");
  }

  // Deliverers
  if (!argv["no-deliverers"]) {
    await timed("deliverers", seedDeliverers);
  } else {
    console.log("⏭️  Skipping deliverers seeding");
  }

  // Package Sizes (box dimensions, etc.)
  if (!argv["no-package-sizes"]) {
    await timed("package-sizes", () => seedPackageSizes());
  } else {
    console.log("⏭️  Skipping package-sizes seeding");
  }

  // Item Packing (bulk densities per item/variety)
  if (!argv["no-item-packing"]) {
    await timed("item-packing", () => seedItemPacking());
  } else {
    console.log("⏭️  Skipping item-packing seeding");
  }

  // Orders next (unless disabled)
  // if (!argv['no-orders']) {
  //   await timed(`Orders (count=${argv.orders})`, seedOrders);
  // } else {
  //   console.log('⏭️  Skipping orders seeding');
  // }

  // Shifts config
  if (!argv["no-shifts"]) {
    await timed(`Shifts (count=${argv.orders})`, seedShiftsConfig);
  } else {
    console.log("⏭️  Skipping shifts seeding");
  }

  // Available stock (market)
  if (!argv["no-available-stock"]) {
    await timed(`available stock`, seedAvailableMarketStock);
  } else {
    console.log("⏭️  Skipping stock seeding");
  }

  // App Config
  if (!argv["no-config"]) {
    await timed(`App Config`, seedAppConfig);
  } else {
    console.log("⏭️  Skipping App Config seeding");
  }

  await disconnectDB();
  console.log("✅ All done.");
}

async function timed(name: string, fn: () => Promise<any>) {
  const t0 = Date.now();
  await fn();
  const ms = Date.now() - t0;
  console.log(`⏱️  ${name} seeding took ${ms} ms`);
}

main()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("❌ Seeding failed:", err);
    try {
      await disconnectDB();
    } catch {}
    process.exit(1);
  });
