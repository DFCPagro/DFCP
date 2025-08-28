/* db/seeds/seed.ts */
import 'dotenv/config';
import minimist from 'minimist';
import { connectDB, disconnectDB } from '../../src/db/connect';

// import seeding functions (refactored below)
import { seedUsers } from './dev/users.seed';
import { seedOrders } from './dev/orders.seed';

type Args = {
  reset?: boolean;
  env?: string;        // just for logging, if you want
  orders?: number;     // how many orders to create
  'no-users'?: boolean;
  'no-orders'?: boolean;
};

async function main() {
  const argv = minimist<Args>(process.argv.slice(2), {
    boolean: ['reset', 'no-users', 'no-orders'],
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

  // Orders next (unless disabled)
  if (!argv['no-orders']) {
    await timed(`Orders (count=${argv.orders})`, () => seedOrders(argv.orders!));
  } else {
    console.log('⏭️  Skipping orders seeding');
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
