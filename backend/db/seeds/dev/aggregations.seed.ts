import { Types } from 'mongoose';
import User from '../../../src/models/user.model';
import Aggregation from '../../../src/models/aggregation.model';
import QrToken from '../../../src/models/QrToken.model';
import { randToken } from '../../../src/utils/crypto';

/**
 * Seed a few sample aggregations for the farmer user. Aggregations are
 * batches of produce items prepared by farmers. Each aggregation is
 * assigned a random QR token with a default expiration of 7 days.  The
 * function clears any existing aggregations and related QR tokens before
 * inserting new records.  It logs details to the console for
 * convenience.
 *
 * @param count Number of aggregations to create (default 2)
 * @param ttlDays TTL in days for the QR tokens (default 7)
 */
export async function seedAggregations(count = 2, ttlDays = 7) {
  // find a farmer user; seeder should have created one
  const farmer = await User.findOne({ role: 'farmer' });
  if (!farmer) throw new Error('No farmer user found. Ensure users seeder created a farmer.');

  console.log(`\n🧹 Clearing existing aggregations for farmer ${farmer.email}`);
  await Aggregation.deleteMany({ farmerId: farmer._id });
  await QrToken.deleteMany({ purpose: 'aggregation' });

  const expireMs = ttlDays * 86400_000;
  const itemsList = [
    [
      { produceType: 'tomato', quantity: 200, unit: 'kg' },
      { produceType: 'cucumber', quantity: 150, unit: 'kg' },
    ],
    [
      { produceType: 'potato', quantity: 300, unit: 'kg' },
      { produceType: 'onion', quantity: 100, unit: 'kg' },
    ],
    [
      { produceType: 'carrot', quantity: 120, unit: 'kg' },
      { produceType: 'pepper', quantity: 80, unit: 'kg' },
    ],
  ];

  console.log(`🌱 Seeding ${count} aggregations…`);
  for (let i = 0; i < count; i++) {
    const items = itemsList[i % itemsList.length];
    const token = randToken();
    const expiresAt = new Date(Date.now() + expireMs);
    const agg = await Aggregation.create({
      farmerId: farmer._id,
      items,
      token,
      expiresAt,
    });
    await QrToken.create({
      aggregation: agg._id,
      purpose: 'aggregation',
      token,
      expiresAt,
    });
    console.log(`   ✅ Aggregation ${agg._id} created with token ${token}`);
  }
  console.log('✅ Aggregations seeded');
}