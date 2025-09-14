import mongoose from 'mongoose';
import * as svc from '../../src/services/deliverer.service';
import Deliverer from '../../src/models/deliverer.model';
import LogisticsCenter from '../../src/models/logisticsCenter.model';
import ApiError from '../../src/utils/ApiError';

// ---- helpers (no .at(), TS-safe) ----
const firstArgOf = <T>(spy: jest.SpyInstance, argIndex = 0): T => {
  const calls = (spy.mock as any).calls as unknown[][];
  const call = calls && calls.length ? calls[0] : undefined;
  if (!call) throw new Error('mock not called');
  return call[argIndex] as T;
};

function chainFind<T = any>(items: T[]) {
  // A tiny chainable query mock for .find().sort().skip().limit()
  const q: any = {
    sort: jest.fn(() => q),
    skip: jest.fn(() => q),
    limit: jest.fn(() => Promise.resolve(items)),
  };
  return q;
}

function mockSession() {
  return {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    abortTransaction: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn(),
  };
}

describe('deliverer.service', () => {
  afterEach(() => jest.restoreAllMocks());

  it('createDeliverer delegates to model.create', async () => {
    const payload = { user: new mongoose.Types.ObjectId(), licenseType: 'A', driverLicenseNumber: 'D' } as any;
    const created = { _id: new mongoose.Types.ObjectId(), ...payload };
    const spy = jest.spyOn(Deliverer, 'create').mockResolvedValue(created as any);

    const out = await svc.createDeliverer(payload);
    expect(out).toBe(created);
    expect(spy).toHaveBeenCalledWith(payload);
  });

  it('getDelivererById returns doc or throws 404', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const doc = { _id: id };

    const spy = jest.spyOn(Deliverer, 'findById').mockResolvedValueOnce(doc as any);
    await expect(svc.getDelivererById(id)).resolves.toBe(doc);
    expect(spy).toHaveBeenCalledWith(id, undefined);

    jest.spyOn(Deliverer, 'findById').mockResolvedValueOnce(null as any);
    await expect(svc.getDelivererById(id)).rejects.toBeInstanceOf(ApiError);
  });

  it('getDelivererByUserId returns doc or throws 404', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const doc = { _id: 'd', user: userId } as any;

    const spy = jest.spyOn(Deliverer, 'findOne').mockResolvedValueOnce(doc);
    await expect(svc.getDelivererByUserId(userId)).resolves.toBe(doc);
    expect(spy).toHaveBeenCalledWith({ user: userId });

    jest.spyOn(Deliverer, 'findOne').mockResolvedValueOnce(null as any);
    await expect(svc.getDelivererByUserId(userId)).rejects.toBeInstanceOf(ApiError);
  });

  it('listDeliverers builds filter (center/currentMonth/insurance/license/search) and paginates', async () => {
    const centerId = new mongoose.Types.ObjectId().toString();
    const expectedItems = [{ _id: 'a' }];

    const findSpy = jest.spyOn(Deliverer, 'find').mockReturnValue(chainFind(expectedItems) as any);
    const countSpy = jest.spyOn(Deliverer, 'countDocuments').mockResolvedValue(1);

    const out = await svc.listDeliverers({
      logisticCenterId: centerId,
      search: 'FORD',
      licenseType: 'C',
      hasVehicleInsurance: true,
      currentMonth: 7,
      page: 2,
      limit: 10,
      sort: 'vehicleMake',
    });

    expect(out.items).toEqual(expectedItems);
    expect(out.page).toBe(2);
    expect(out.limit).toBe(10);
    expect(out.total).toBe(1);
    expect(out.pages).toBe(1);

    const filterArg = firstArgOf<Record<string, any>>(findSpy);
    expect(filterArg.currentMonth).toBe(7);
    expect(filterArg.vehicleInsurance).toBe(true);
    expect(filterArg.licenseType).toBe('C');
    expect(filterArg.logisticCenterIds).toEqual({ $in: [centerId] });
    expect(filterArg.$or).toBeDefined();

    expect(countSpy).toHaveBeenCalledWith(filterArg);
  });

  it('updateDeliverer returns doc or throws 404', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const updated = { _id: id, licenseType: 'B' } as any;

    // cast mockImplementation to any to bypass Mongoose Query typing
    const spy = jest
      .spyOn(Deliverer, 'findByIdAndUpdate')
      .mockImplementation((() => Promise.resolve(updated)) as any);

    await expect(svc.updateDeliverer(id, { licenseType: 'B' } as any)).resolves.toBe(updated);
    expect(spy).toHaveBeenCalled();

    jest
      .spyOn(Deliverer, 'findByIdAndUpdate')
      .mockImplementation((() => Promise.resolve(null)) as any);

    await expect(svc.updateDeliverer(id, {} as any)).rejects.toBeInstanceOf(ApiError);
  });

  it('deleteDeliverer returns success or throws 404', async () => {
    const id = new mongoose.Types.ObjectId().toString();

    jest
      .spyOn(Deliverer, 'findByIdAndDelete')
      .mockImplementation((() => Promise.resolve({ _id: id })) as any);

    await expect(svc.deleteDeliverer(id)).resolves.toEqual({ success: true });

    jest
      .spyOn(Deliverer, 'findByIdAndDelete')
      .mockImplementation((() => Promise.resolve(null)) as any);

    await expect(svc.deleteDeliverer(id)).rejects.toBeInstanceOf(ApiError);
  });

  it('setDayShift validates, toggles bits, and saves', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const fakeDoc: any = {
      _id: id,
      activeSchedule: [0, 0, 0],
      save: jest.fn().mockResolvedValue(undefined),
      isAvailable: jest.fn(),
    };

    jest.spyOn(svc, 'getDelivererById').mockResolvedValue(fakeDoc);

    // enable morning(1) and evening(4) on day 1
    await svc.setDayShift(id, 1, 1, true);
    await svc.setDayShift(id, 1, 4, true);
    expect(fakeDoc.activeSchedule[1]).toBe(1 | 4);

    // disable evening(4)
    await svc.setDayShift(id, 1, 4, false);
    expect(fakeDoc.activeSchedule[1]).toBe(1);

    // invalid dayIndex
    await expect(svc.setDayShift(id, 99, 1, true)).rejects.toBeInstanceOf(ApiError);
    // invalid mask
    await expect(svc.setDayShift(id, 0, 16, true)).rejects.toBeInstanceOf(ApiError);
  });

  it('checkAvailability uses model method', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const fakeDoc: any = {
      _id: id,
      isAvailable: jest.fn().mockReturnValue(true),
    };
    jest.spyOn(svc, 'getDelivererById').mockResolvedValue(fakeDoc);

    const out = await svc.checkAvailability(id, 0, 1);
    expect(fakeDoc.isAvailable).toHaveBeenCalledWith(0, 1);
    expect(out).toEqual({ available: true });
  });

  it('advanceMonth uses nextSchedule when applyNext=true; else leaves activeSchedule unset (hook zeros in real DB)', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const baseDoc: any = {
      _id: id,
      currentMonth: 12,
      nextSchedule: [1, 0, 0],
    };

    jest.spyOn(svc, 'getDelivererById').mockResolvedValue(baseDoc);

    const upd = jest
      .spyOn(Deliverer, 'findByIdAndUpdate')
      .mockImplementation(((/* id, update */ _id: any, update: any) =>
        Promise.resolve({
          _id,
          currentMonth: update.$set.currentMonth,
          activeSchedule: update.$set.activeSchedule ?? [],
          nextSchedule: update.$set.nextSchedule ?? [],
        })) as any);

    // applyNext = true -> use nextSchedule and clear it
    const a = await svc.advanceMonth(id, true);
    expect(a.currentMonth).toBe(1);
    expect(a.activeSchedule).toEqual([1, 0, 0]);
    expect(a.nextSchedule).toEqual([]);

    // applyNext = false -> service leaves activeSchedule unset; model hook would zero it in real DB
    const b = await svc.advanceMonth(id, false);
    expect(b.currentMonth).toBe(1);
    expect(b.activeSchedule).toEqual([]);

    expect(upd).toHaveBeenCalledTimes(2);
  });

  it('listCentersForDeliverer finds centers (lean)', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const centerIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];

    jest.spyOn(Deliverer, 'findById').mockReturnValue({
      lean: () => ({
        exec: () =>
          Promise.resolve({
            _id: id,
            logisticCenterIds: centerIds,
            user: new mongoose.Types.ObjectId(),
          }),
      }),
    } as any);

    const centers = [{ _id: centerIds[0] }, { _id: centerIds[1] }];
    jest.spyOn(LogisticsCenter, 'find').mockReturnValue({
      lean: () => Promise.resolve(centers),
    } as any);

    const out = await svc.listCentersForDeliverer(id);
    expect(out).toEqual(centers);
  });

  // ----- assignments with transactions -----

  it('assignDelivererToCenter validates ids', async () => {
    await expect(svc.assignDelivererToCenter('bad', 'also-bad')).rejects.toBeInstanceOf(ApiError);
  });

  it('assignDelivererToCenter adds center to deliverer and user to LC.employeeIds (txn)', async () => {
    const delivererId = new mongoose.Types.ObjectId().toString();
    const centerId = new mongoose.Types.ObjectId().toString();
    const userId = new mongoose.Types.ObjectId();

    const session = mockSession();
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session as any);

    const updatedDeliverer = { _id: delivererId, user: userId, logisticCenterIds: [centerId] } as any;

    jest
      .spyOn(Deliverer, 'findByIdAndUpdate')
      .mockImplementation((() => Promise.resolve(updatedDeliverer)) as any);

    jest
      .spyOn(LogisticsCenter, 'findByIdAndUpdate')
      .mockImplementation((() => Promise.resolve({ _id: centerId })) as any);

    const out = await svc.assignDelivererToCenter(delivererId, centerId);

    expect(session.commitTransaction).toHaveBeenCalled();
    expect(out).toEqual(updatedDeliverer);
  });

  it('unassignDelivererFromCenter pulls center and user from LC (txn)', async () => {
    const delivererId = new mongoose.Types.ObjectId().toString();
    const centerId = new mongoose.Types.ObjectId().toString();
    const userId = new mongoose.Types.ObjectId();

    const session = mockSession();
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session as any);

    const updatedDeliverer = { _id: delivererId, user: userId, logisticCenterIds: [] } as any;

    jest
      .spyOn(Deliverer, 'findByIdAndUpdate')
      .mockImplementation((() => Promise.resolve(updatedDeliverer)) as any);

    jest
      .spyOn(LogisticsCenter, 'findByIdAndUpdate')
      .mockImplementation((() => Promise.resolve({ _id: centerId })) as any);

    const out = await svc.unassignDelivererFromCenter(delivererId, centerId);

    expect(session.commitTransaction).toHaveBeenCalled();
    expect(out).toEqual(updatedDeliverer);
  });
});
