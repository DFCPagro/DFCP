import mongoose from 'mongoose';
import * as svc from '../../src/services/deliverer.service';
import Deliverer from '../../src/models/deliverer.model';
import LogisticsCenter from '../../src/models/logisticsCenter.model';

// ——— helpers ———
const idStr = (v: any): string => (v?._id ? String(v._id) : String(v)); // normalize doc or raw ObjectId
const asId = (v: any): mongoose.Types.ObjectId => v as mongoose.Types.ObjectId;

describe('INTEGRATION: deliverer.service', () => {
  it('create/get/list/update/delete roundtrip', async () => {
    const userId = new mongoose.Types.ObjectId();

    // create
    const created = await svc.createDeliverer({
      user: userId,
      licenseType: 'B',
      driverLicenseNumber: 'DL-XYZ',
      vehicleMake: 'Ford',
      vehicleModel: 'Transit',
      currentMonth: 1,
    } as any);

    expect(idStr(created)).toBeDefined();
    expect(String(created.user)).toBe(String(userId));

    // get by id
    const got = await svc.getDelivererById(idStr(created));
    expect(String(got.user)).toBe(String(userId));
    expect(Array.isArray(got.activeSchedule)).toBe(true);
    expect(got.activeSchedule.length).toBeGreaterThanOrEqual(28);
    expect(got.activeSchedule.length).toBeLessThanOrEqual(31);

    // get by user
    const byUser = await svc.getDelivererByUserId(String(userId));
    expect(idStr(byUser)).toBe(idStr(created));

    // list with filters (search, insurance, license, month)
    await Deliverer.findByIdAndUpdate(created._id, { vehicleInsurance: true });
    const list = await svc.listDeliverers({
      search: 'Transit',
      hasVehicleInsurance: true,
      licenseType: 'B',
      currentMonth: got.currentMonth,
      page: 1,
      limit: 10,
    });
    expect(list.items.length).toBe(1);
    expect(list.total).toBe(1);

    // update
    const updated = await svc.updateDeliverer(idStr(created), { speedKmH: 80 } as any);
    expect(updated.speedKmH).toBe(80);

    // delete
    const del = await svc.deleteDeliverer(idStr(created));
    expect(del).toEqual({ success: true });
    await expect(svc.getDelivererById(idStr(created))).rejects.toBeTruthy();
  });

  it('schedule ops: setDayShift, setActiveSchedule, setNextSchedule, checkAvailability, advanceMonth', async () => {
    const d = await svc.createDeliverer({
      user: new mongoose.Types.ObjectId(),
      licenseType: 'A',
      driverLicenseNumber: 'DL-1',
      currentMonth: 2, // Feb (28)
    } as any);

    // length should be for Feb
    const refetched = await svc.getDelivererById(idStr(d));
    expect(refetched.activeSchedule.length).toBe(28);

    // toggle morning(1) + evening(4) on day index 1
    await svc.setDayShift(idStr(d), 1, 1, true);
    await svc.setDayShift(idStr(d), 1, 4, true);

    let check = await svc.checkAvailability(idStr(d), 1, 1);
    expect(check.available).toBe(true);
    check = await svc.checkAvailability(idStr(d), 1, 2);
    expect(check.available).toBe(false);
    check = await svc.checkAvailability(idStr(d), 1, 4);
    expect(check.available).toBe(true);

    // replace entire active schedule
    const newActive = Array(28).fill(0);
    newActive[0] = 0b1111;
    await svc.setActiveSchedule(idStr(d), newActive);
    const re1 = await svc.getDelivererById(idStr(d));
    expect(re1.activeSchedule[0]).toBe(15);

    // set next schedule and advance with applyNext=true
    const next = Array(28).fill(0);
    next[5] = 0b0101;
    await svc.setNextSchedule(idStr(d), next);
    const afterApply = await svc.advanceMonth(idStr(d), true);
    expect(afterApply.currentMonth).toBe(3); // Feb -> Mar
    expect(afterApply.activeSchedule[5]).toBe(5);
    expect(afterApply.nextSchedule.length).toBe(0);

    // advance without applyNext -> model hook zeros for new month
    const afterNoApply = await svc.advanceMonth(idStr(d), false);
    expect(afterNoApply.currentMonth).toBe(4); // Mar -> Apr
    expect(Array.isArray(afterNoApply.activeSchedule)).toBe(true);
  });

  it('center assignments use transactions and mirror user in center.employeeIds', async () => {
    // Create a deliverer (has user field)
    const d = await svc.createDeliverer({
      user: new mongoose.Types.ObjectId(),
      licenseType: 'C',
      driverLicenseNumber: 'DL-TRX',
      currentMonth: 1,
    } as any);

    // Create a center
    const center = await LogisticsCenter.create({
      logisticName: 'North Hub',
      location: { name: 'North City', geo: { type: 'Point', coordinates: [35.1, 32.1] } },
      employeeIds: [],
      deliveryHistory: [],
    });

    const centerId = idStr(center);

    // assign
    const assigned = await svc.assignDelivererToCenter(idStr(d), centerId);
    expect(assigned.logisticCenterIds.map(String)).toContain(centerId);

    const centerAfterAssign = await LogisticsCenter.findById(asId(center._id)).lean();
    expect((centerAfterAssign?.employeeIds as any[]).map(String)).toContain(String(d.user));

    // list centers for deliverer
    const centers = await svc.listCentersForDeliverer(idStr(d));
    expect(centers.map((c: any) => idStr(c))).toContain(centerId);

    // unassign
    const unassigned = await svc.unassignDelivererFromCenter(idStr(d), centerId);
    expect(unassigned.logisticCenterIds.map(String)).not.toContain(centerId);

    const centerAfterUnassign = await LogisticsCenter.findById(asId(center._id)).lean();
    expect((centerAfterUnassign?.employeeIds as any[]).map(String)).not.toContain(String(d.user));
  });
});
