/* db/seeds/seed.ts */
import 'dotenv/config';
import minimist from 'minimist';
import { connectDB, disconnectDB } from '../../src/db/connect';

// import seeding functions (refactored below)
import { seedUsers } from './dev/users.seeder';
import { seedItems } from './dev/items.seeder'
import { seedLogisticsCenters } from './dev/logisticsCenters.seeder'


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

  // // Orders next (unless disabled)
  // if (!argv['no-orders']) {
  //   await timed(`Orders (count=${argv.orders})`, () => seedOrders(argv.orders!));
  // } else {
  //   console.log('⏭️  Skipping orders seeding');
  // }

  // // Aggregations
  // if (!argv['no-aggregations']) {
  //   await timed('Aggregations', () => seedAggregations());
  // } else {
  //   console.log('⏭️  Skipping aggregations seeding');
  // }

  // // Containers
  // if (!argv['no-containers']) {
  //   await timed('Containers', () => seedContainers());
  // } else {
  //   console.log('⏭️  Skipping containers seeding');
  // }

  // // Shipments
  // if (!argv['no-shipments']) {
  //   await timed('Shipments', () => seedShipments());
  // } else {
  //   console.log('⏭️  Skipping shipments seeding');
  // }

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
