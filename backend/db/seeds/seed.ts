/* db/seeds/seed.ts */
import 'dotenv/config';
import minimist from 'minimist';
import { connectDB, disconnectDB } from '../../src/db/connect';

// import seeding functions (refactored below)
import { seedUsers } from './dev/users.seeder';
import { seedItems } from './dev/items.seeder'
import { seedLogisticsCenters } from './dev/logisticCenters.seeder'
import { seedDeliverers } from './dev/deliverers.seed'
// import { seedOrders } from './dev/orders.seed'
import { seedShiftsConfig } from './dev/shiftConfig.seeder';
import seedAppConfig from './dev/seedAppConfig';
import seedAvailableMarketStock from './dev/seedAvailableMarketStock';

type Args = {
  reset?: boolean;
  env?: string;        // just for logging, if you want
  orders?: number;     // how many orders to create
  'no-users'?: boolean;
  'no-orders'?: boolean;
  /** Skip aggregation seeding */
  'no-aggregations'?: boolean;
  /** Skip container seeding */
  'no-containers'?: boolean;
  /** Skip shipment seeding */
  'no-shipments'?: boolean;
};

async function main() {
  const argv = minimist<Args>(process.argv.slice(2), {
    boolean: ['reset', 'no-users', 'no-orders', 'no-aggregations', 'no-containers', 'no-shipments'],
    string: ['env'],
    default: { orders: 15 },
    alias: { r: 'reset' },
  });

  console.log('🌱 Seed orchestrator starting…');
  console.log('   flags:', argv);

  const conn = await connectDB();
  console.log(`🔌 Connected to ${conn.name}`);

  if (argv.reset) {
    console.log(`⚠️ Dropping database: ${conn.name}…`);
    await conn.dropDatabase();
    console.log('✅ Database dropped');
  }

  // Users first (unless disabled)
  if (!argv['no-users']) {
    await timed('Users', seedUsers);
  } else {
    console.log('⏭️  Skipping users seeding');
  }

  if (!argv['no-items']){
    await timed('Items', seedItems)
  } else{
    console.log('⏭️  Skipping items seeding');
  }

  if (!argv['no-logistic-centers']){
    await timed('logsitic-center', seedLogisticsCenters)
  } else{
    console.log('⏭️  Skipping logistic-centers seeding');
  }

  if (!argv['no-deliverers']){
    await timed('deliverers', seedDeliverers)
  } else{
    console.log('⏭️  Skipping deliverers seeding');
  }

  // Orders next (unless disabled)
  // if (!argv['no-orders']) {
  //   await timed(`Orders (count=${argv.orders})`, seedOrders);
  // } else {
  //   console.log('⏭️  Skipping orders seeding');
  // }

  // Orders next (unless disabled)
  if (!argv['no-shifts']) {
    await timed(`Shifts (count=${argv.orders})`, seedShiftsConfig);
  } else {
    console.log('⏭️  Skipping shofts seeding');
  }

  if (!argv['no-available-stock']) {
    await timed(`available stock`, seedAvailableMarketStock);
  } else {
    console.log('⏭️  Skipping stock seeding');
  }

  if (!argv['no-config']) {
    await timed(`App Config`, seedAppConfig);
  } else {
    console.log('⏭️  Skipping App Config seeding');
  }

  await disconnectDB();
  console.log('✅ All done.');
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
    console.error('❌ Seeding failed:', err);
    try { await disconnectDB(); } catch {}
    process.exit(1);
  });
