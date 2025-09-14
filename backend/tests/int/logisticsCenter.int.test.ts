import mongoose from 'mongoose';
import * as svc from '../../src/services/logisticsCenter.service';
import LogisticsCenter from '../../src/models/logisticsCenter.model';
import Order from '../../src/models/order.model';

// ——— helpers ———
const idStr = (v: any): string => (v?._id ? String(v._id) : String(v));
const asId = (v: any): mongoose.Types.ObjectId => v as mongoose.Types.ObjectId;

// Active statuses used inside the service
const ACTIVE = ['confirmed', 'packing', 'ready_for_pickup', 'in-transit', 'out_for_delivery'];

describe('INTEGRATION: logisticsCenter.service', () => {
  it('create/get/update/delete roundtrip', async () => {
    // create
    const lc = await svc.createLogisticsCenter({
      logisticName: 'Alpha',
      location: { name: 'Tel Aviv', geo: { type: 'Point', coordinates: [34.78, 32.08] } },
    });
    const lcId = idStr(lc);
    expect(lcId).toBeDefined();

    // getById with select & no populate
    const got = await svc.getLogisticsCenterById(lcId, { select: 'logisticName location.name' });
    expect(got && idStr(got)).toBe(lcId);
    expect((got as any).logisticName).toBe('Alpha');

    // list simple path with search + employee filter
    const emp = new mongoose.Types.ObjectId();
    await LogisticsCenter.findByIdAndUpdate(asId(lc._id), { $addToSet: { employeeIds: emp } });

    const list = await svc.queryLogisticsCenters(
      { search: 'Alpha', employeeId: String(emp) },
      { page: 1, limit: 10, sort: 'logisticName', select: 'logisticName location.name' }
    );
    expect(list.results.length).toBe(1);
    expect(list.total).toBe(1);
    expect((list.results[0] as any).logisticName).toBe('Alpha');

    // update
    const upd = await svc.updateLogisticsCenterById(
      lcId,
      { logisticName: 'Alpha Prime' },
      { select: 'logisticName' }
    );
    expect((upd as any)?.logisticName).toBe('Alpha Prime');

    // delete
    await expect(svc.deleteLogisticsCenterById(lcId)).resolves.toBeUndefined();
    const missing = await svc.getLogisticsCenterById(lcId);
    expect(missing).toBeNull();
  });

  it('queryLogisticsCenters with active=true uses aggregation over orders', async () => {
    // create two centers
    const c1 = await LogisticsCenter.create({
      logisticName: 'C1',
      location: { name: 'Haifa', geo: { type: 'Point', coordinates: [35.0, 32.8] } },
      employeeIds: [],
      deliveryHistory: [],
    });
    const c2 = await LogisticsCenter.create({
      logisticName: 'C2',
      location: { name: 'Jerusalem', geo: { type: 'Point', coordinates: [35.22, 31.77] } },
      employeeIds: [],
      deliveryHistory: [],
    });

    const ordersCol = mongoose.connection.collection(Order.collection.name);
    await ordersCol.insertOne({
      logisticCenterId: asId(c1._id),
      status: ACTIVE[0], // 'confirmed'
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // active=true should return only c1
    const act = await svc.queryLogisticsCenters({ active: true }, { page: 1, limit: 10, sort: 'logisticName' });
    expect(act.results.map((d: any) => idStr(d))).toEqual([idStr(c1)]);
    expect(act.total).toBe(1);

    // active=false should return only c2
    const inact = await svc.queryLogisticsCenters({ active: false }, { page: 1, limit: 10, sort: 'logisticName' });
    expect(inact.results.map((d: any) => idStr(d))).toEqual([idStr(c2)]);
    expect(inact.total).toBe(1);
  });

  it('listDeliverersForCenter paginates deliverers assigned to a center', async () => {
    const center = await LogisticsCenter.create({
      logisticName: 'West',
      location: { name: 'Ashdod', geo: { type: 'Point', coordinates: [34.65, 31.80] } },
    });
    const centerId = idStr(center);

    // create two deliverers and assign their logisticCenterIds directly
    const DelivererModel = (await import('../../src/models/deliverer.model')).default;

    const d1 = await DelivererModel.create({
      user: new mongoose.Types.ObjectId(),
      licenseType: 'B',
      driverLicenseNumber: 'D1',
      logisticCenterIds: [asId(center._id)],
      currentMonth: 1,
    } as any);

    const d2 = await DelivererModel.create({
      user: new mongoose.Types.ObjectId(),
      licenseType: 'C',
      driverLicenseNumber: 'D2',
      logisticCenterIds: [asId(center._id)],
      currentMonth: 1,
    } as any);

    const page1 = await svc.listDeliverersForCenter(centerId, { page: 1, limit: 1, sort: 'driverLicenseNumber' });
    expect(page1.items.length).toBe(1);
    expect(page1.total).toBe(2);
    expect(page1.pages).toBe(2);

    const page2 = await svc.listDeliverersForCenter(centerId, { page: 2, limit: 1, sort: 'driverLicenseNumber' });
    expect(page2.items.length).toBe(1);
    expect(page2.total).toBe(2);
    expect(page2.pages).toBe(2);

    const seen = new Set([...page1.items, ...page2.items].map((x: any) => idStr(x)));
    expect(seen.has(idStr(d1))).toBe(true);
    expect(seen.has(idStr(d2))).toBe(true);
  });
});
