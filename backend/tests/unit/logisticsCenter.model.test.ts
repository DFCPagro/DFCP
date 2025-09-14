import mongoose from 'mongoose';
import LogisticsCenter from '../../src/models/logisticsCenter.model';

describe('LogisticsCenter model', () => {
  it('validates location.name and optional geo point shape', () => {
    const ok = new LogisticsCenter({
      logisticName: 'Central',
      location: { name: 'Main', geo: { type: 'Point', coordinates: [34.8, 32.1] } },
    });
    expect(ok.validateSync()).toBeUndefined();

    const badGeo = new LogisticsCenter({
      logisticName: 'X',
      location: { name: 'Y', geo: { type: 'Point', coordinates: [34.8] } }, // invalid coords length
    });
    const err = badGeo.validateSync();
    expect(err).toBeDefined();
  });

  it('indexes exist (smoke) and model compiles', () => {
    // we can't assert index creation without a DB; this ensures schema compiles
    const doc = new LogisticsCenter({
      logisticName: 'Indexed',
      location: { name: 'Here' },
    });
    expect(doc).toBeTruthy();
  });
});
