/*
 * Migration to introduce aggregations, arrival tokens on shipments, and extend QR tokens.
 *
 * This migration performs the following steps:
 *  1. Create the `aggregations` collection if it does not exist.
 *  2. Ensure indexes on the `qrTokens` collection for the new `shipment` and `aggregation` fields.
 *  3. Ensure new fields exist on the `containers` and `shipments` collections. In MongoDB there
 *     is no schema to update, but we can update all existing documents to add missing fields
 *     with null values so that future code expecting them does not encounter undefined.
 */

module.exports = {
  async up(db) {
    // 1. Create aggregations collection with basic validator
    const aggsExists = await db.listCollections({ name: 'aggregations' }).toArray();
    if (aggsExists.length === 0) {
      await db.createCollection('aggregations');
      // Basic schema validation for safety (optional)
      await db.command({
        collMod: 'aggregations',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['farmerId', 'items', 'token'],
            properties: {
              farmerId: { bsonType: 'objectId' },
              items: { bsonType: 'array' },
              token: { bsonType: 'string' },
              expiresAt: { bsonType: ['date', 'null'] },
              containers: { bsonType: ['array', 'null'] },
            },
          },
        },
        validationLevel: 'moderate',
      }).catch(() => {});
      await db.collection('aggregations').createIndex({ token: 1 }, { unique: true, name: 'token_1' });
      await db.collection('aggregations').createIndex({ farmerId: 1 }, { name: 'farmerId_1' });
    }

    // 2. Extend qrTokens with indexes for shipment and aggregation. Because MongoDB is schemaless
    // we don't need to add the field to every document, but we create indexes to support queries.
    const qrTokens = db.collection('qrtokens');
    const qrIdx = await qrTokens.indexes();
    const needShipmentIdx = !qrIdx.some(i => i.name === 'shipment_1');
    const needAggregationIdx = !qrIdx.some(i => i.name === 'aggregation_1');
    if (needShipmentIdx) await qrTokens.createIndex({ shipment: 1 }, { name: 'shipment_1' });
    if (needAggregationIdx) await qrTokens.createIndex({ aggregation: 1 }, { name: 'aggregation_1' });

    // 3. Add new fields to existing containers and shipments to avoid undefined values.
    const containers = db.collection('containers');
    await containers.updateMany(
      { scannedBy: { $exists: false } },
      { $set: { scannedBy: null, scannedAt: null, aggregationId: null } }
    );
    const shipments = db.collection('shipments');
    await shipments.updateMany(
      { arrivalToken: { $exists: false } },
      { $set: { arrivalToken: null, arrivalExpiresAt: null, arrivalUsedAt: null } }
    );
  },
  async down(db) {
    // drop aggregations collection
    await db.collection('aggregations').drop().catch(() => {});
    // drop indexes on qrTokens
    const qrTokens = db.collection('qrtokens');
    await qrTokens.dropIndex('shipment_1').catch(() => {});
    await qrTokens.dropIndex('aggregation_1').catch(() => {});
    // Remove fields from containers and shipments (not strictly necessary)
    const containers = db.collection('containers');
    await containers.updateMany({}, { $unset: { scannedBy: '', scannedAt: '', aggregationId: '' } });
    const shipments = db.collection('shipments');
    await shipments.updateMany({}, { $unset: { arrivalToken: '', arrivalExpiresAt: '', arrivalUsedAt: '' } });
  },
};