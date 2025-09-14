import mongoose from 'mongoose';
import Deliverer from '../../src/models/deliverer.model';

describe('Deliverer model', () => {
  it('pre("validate") pads/truncates activeSchedule to month length', async () => {
    const doc = new Deliverer({
      user: new mongoose.Types.ObjectId(),
      licenseType: 'A',
      driverLicenseNumber: 'DL-1',
      currentMonth: 2,              // Feb (28)
      activeSchedule: [1, 2, 4],    // too short
    });

    // IMPORTANT: validate() (async) runs pre('validate') hooks; validateSync() does not.
    await doc.validate();
    expect(doc.activeSchedule).toHaveLength(28);
    // first entries are preserved
    expect(doc.activeSchedule[0]).toBe(1);
    expect(doc.activeSchedule[1]).toBe(2);
    expect(doc.activeSchedule[2]).toBe(4);
  });

  it('isAvailable uses bitmask properly', () => {
    // day 0 mask = 1|4 = morning+evening
    const doc = new Deliverer({
      user: new mongoose.Types.ObjectId(),
      licenseType: 'B',
      driverLicenseNumber: 'DL-2',
      currentMonth: 1,
      activeSchedule: [1 | 4, ...Array(30).fill(0)],
    });

    expect(doc.isAvailable(0, 1)).toBe(true);   // morning
    expect(doc.isAvailable(0, 2)).toBe(false);  // afternoon
    expect(doc.isAvailable(0, 4)).toBe(true);   // evening
    expect(doc.isAvailable(1, 1)).toBe(false);  // other day
    expect(doc.isAvailable(-1, 1)).toBe(false);
    expect(doc.isAvailable(99, 1)).toBe(false);
  });
});
