import { Types } from 'mongoose';
import User from '../../../src/models/user.model';
import Container from '../../../src/models/container.model';
import Shipment from '../../../src/models/shipment.model';
import QrToken from '../../../src/models/QrToken.model';
import { randToken } from '../../../src/utils/crypto';

/**
 * Seed shipments for testing.  It groups available containers into one or
 * more shipments, assigns them to a driver and generates arrival tokens.
 * Shipments are created with status 'planned' and have an arrival token
 * with a 2‑day expiry by default.
 *
 * All existing shipments and associated arrival QR tokens are removed
 * before seeding new ones.
 *
 * @param containersPerShipment How many containers per shipment (default 4)
 * @param ttlDays Expiration time in days for arrival tokens (default 2)
 */
export async function seedShipments(containersPerShipment = 4, ttlDays = 2) {
  const driver = await User.findOne({ role: 'driver' });
  if (!driver) throw new Error('No driver user found. Ensure users seeder created a driver.');

  console.log(`\n🧹 Clearing existing shipments and arrival tokens…`);
  await Shipment.deleteMany({});
  await QrToken.deleteMany({ purpose: 'arrival' });

  const allContainers = await Container.find({}).lean();
  if (allContainers.length === 0) {
    console.warn('⚠️ No containers found. Seed containers first.');
    return;
  }
  console.log(`🌱 Seeding shipments with ${containersPerShipment} containers each…`);
  const expiryMs = ttlDays * 86400_000;
  let batch: any[] = [];
  let shipmentCount = 0;

  for (const cont of allContainers) {
    batch.push(cont);
    if (batch.length === containersPerShipment) {
      shipmentCount++;
      const containerIds = batch.map((c) => c._id);
      const shipment = await Shipment.create({
        driverId: driver._id,
        containers: containerIds,
        status: 'planned',
      });
      // create arrival token
      const token = randToken();
      const expiresAt = new Date(Date.now() + expiryMs);
      shipment.set({ arrivalToken: token, arrivalExpiresAt: expiresAt });
      await shipment.save();
      await QrToken.create({ shipment: shipment._id, purpose: 'arrival', token, expiresAt });
      console.log(`   ✅ Shipment ${shipment._id} created with ${batch.length} containers; arrival token=${token}`);
      batch = [];
    }
  }
  // leftover containers
  if (batch.length) {
    shipmentCount++;
    const containerIds = batch.map((c) => c._id);
    const shipment = await Shipment.create({
      driverId: driver._id,
      containers: containerIds,
      status: 'planned',
    });
    const token = randToken();
    const expiresAt = new Date(Date.now() + expiryMs);
    shipment.arrivalToken = token;
    shipment.arrivalExpiresAt = expiresAt;
    await shipment.save();
    await QrToken.create({ shipment: shipment._id, purpose: 'arrival', token, expiresAt });
    console.log(`   ✅ Shipment ${shipment._id} created with ${batch.length} containers; arrival token=${token}`);
  }
  console.log(`✅ Shipments seeded (${shipmentCount} total)`);
}