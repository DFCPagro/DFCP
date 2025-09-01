import { Types } from 'mongoose';
import User from '../../../src/models/user.model';
import Aggregation from '../../../src/models/aggregation.model';
import Container from '../../../src/models/container.model';
import generateId from '../../../src/utils/generateId';

/**
 * Seed containers for the farmer user.  It will assign a few containers to
 * each existing aggregation and create some standalone containers as well.
 * Each container has a unique barcode generated via generateId('c_').
 *
 * This function clears all existing containers before inserting new ones.
 *
 * @param containersPerAgg Number of containers to assign per aggregation (default 3)
 * @param unlinkedContainers Number of standalone containers not tied to any aggregation (default 2)
 */
export async function seedContainers(containersPerAgg = 3, unlinkedContainers = 2) {
  const farmer = await User.findOne({ role: 'farmer' });
  if (!farmer) throw new Error('No farmer user found. Ensure users seeder created a farmer.');

  console.log(`\n🧹 Clearing existing containers…`);
  await Container.deleteMany({});

  const aggs = await Aggregation.find({ farmerId: farmer._id });
  console.log(`🌱 Seeding containers: ${aggs.length} aggregations × ${containersPerAgg} each + ${unlinkedContainers} unlinked`);

  const produceTypes = ['tomato', 'cucumber', 'potato', 'onion', 'carrot', 'pepper'];
  const randomPick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
  const randomQty = () => Math.floor(Math.random() * 200) + 50;

  // assign containers to each aggregation
  for (const agg of aggs) {
    for (let i = 0; i < containersPerAgg; i++) {
      const barcode = generateId('c_');
      const produceType = randomPick(produceTypes);
      const quantity = randomQty();
      const c = await Container.create({
        produceType,
        quantity,
        barcode,
        reportedBy: farmer._id,
        aggregationId: agg._id,
      });
      // update aggregation with new container id
      await Aggregation.findByIdAndUpdate(agg._id, { $push: { containers: c._id } });
      console.log(`   ✅ Container ${c.barcode} linked to aggregation ${agg.token}`);
    }
  }

  // create some containers with no aggregation
  for (let i = 0; i < unlinkedContainers; i++) {
    const barcode = generateId('c_');
    const produceType = randomPick(produceTypes);
    const quantity = randomQty();
    const c = await Container.create({
      produceType,
      quantity,
      barcode,
      reportedBy: farmer._id,
    });
    console.log(`   ✅ Unlinked container ${c.barcode} created`);
  }
  console.log('✅ Containers seeded');
}