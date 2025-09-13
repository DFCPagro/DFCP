import LogisticsCenter from '../../src/models/logisticsCenter.model';

export async function seedCenters() {
  const docs = await LogisticsCenter.insertMany([
    {
      logisticName: 'Tel Aviv Logistics Center',
      location: { name: 'Tel Aviv', geo: { type: 'Point', coordinates: [34.781768, 32.0853] } },
      employeeIds: [],
      deliveryHistory: [{ message: 'Opened hub', at: new Date(), by: null }],
    },
    {
      logisticName: 'Jerusalem Logistics Center',
      location: { name: 'Jerusalem' },
      employeeIds: [],
      deliveryHistory: [],
    },
  ]);
  return docs.map(d => d.toJSON());
}
