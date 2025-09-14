import mongoose from 'mongoose';
import * as svc from '../../src/services/logisticsCenter.service';
import LogisticsCenter from '../../src/models/logisticsCenter.model';
import Order from '../../src/models/order.model';
import DelivererModel from '../../src/models/deliverer.model';

// ---- helpers (no .at(), TS-safe) ----
const firstArgOf = <T>(spy: jest.SpyInstance, argIndex = 0): T => {
  const calls = (spy.mock as any).calls as unknown[][];
  const call = calls && calls.length ? calls[0] : undefined;
  if (!call) throw new Error('mock not called');
  return call[argIndex] as T;
};

function chainFind<T = any>(items: T[]) {
  const q: any = {
    select: jest.fn(() => q),
    populate: jest.fn(() => q),
    sort: jest.fn(() => q),
    skip: jest.fn(() => q),
    // FIX: return q here, not a Promise, so we can call .lean().exec()
    limit: jest.fn(() => q),
    lean: jest.fn(() => q),
    exec: jest.fn(() => Promise.resolve(items)),
  };
  return q;
}

describe('logisticsCenter.service', () => {
  afterEach(() => jest.restoreAllMocks());

  it('createLogisticsCenter proxies to model.create', async () => {
    const payload = {
      logisticName: 'LC1',
      location: { name: 'HQ', geo: { type: 'Point', coordinates: [1, 2] } },
    };
    const created = { _id: 'x', ...payload };

    const spy = jest.spyOn(LogisticsCenter, 'create').mockResolvedValue(created as any);
    const out = await svc.createLogisticsCenter(payload as any);
    expect(out).toBe(created);
    expect(spy).toHaveBeenCalledWith(payload);
  });

  it('getLogisticsCenterById applies select & populate & lean', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const item = { _id: id, logisticName: 'LC' };

    const q: any = {
      select: jest.fn(() => q),
      populate: jest.fn(() => q),
      lean: jest.fn(() => q),
      exec: jest.fn(() => Promise.resolve(item)),
    };

    const spy = jest.spyOn(LogisticsCenter, 'findById').mockReturnValue(q);
    const out = await svc.getLogisticsCenterById(id, { populate: true, select: 'logisticName' });
    expect(spy).toHaveBeenCalledWith(id);
    expect(q.select).toHaveBeenCalledWith('logisticName');
    expect(q.populate).toHaveBeenCalled();
    expect(q.lean).toHaveBeenCalled();
    expect(out).toEqual(item);
  });

  it('queryLogisticsCenters (simple path) uses .find with filters + pagination', async () => {
    const items = [{ _id: 'a' }];
    const findSpy = jest.spyOn(LogisticsCenter, 'find').mockReturnValue(chainFind(items) as any);
    const countSpy = jest.spyOn(LogisticsCenter, 'countDocuments').mockResolvedValue(1);

    const data = await svc.queryLogisticsCenters(
      { search: 'hub', employeeId: new mongoose.Types.ObjectId().toString() },
      { page: 2, limit: 5, sort: 'logisticName', select: 'logisticName location.name', populate: true }
    );

    expect(data.results).toEqual(items);
    expect(data.page).toBe(2);
    expect(data.limit).toBe(5);
    expect(data.total).toBe(1);
    expect(data.totalPages).toBe(1);

    const where = firstArgOf<Record<string, any>>(findSpy);
    expect(where.$or).toBeDefined();
    expect(where.employeeIds).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(countSpy).toHaveBeenCalledWith(where);
  });

  it('queryLogisticsCenters (active=true) uses aggregation with $lookup to orders', async () => {
    const items = [{ _id: 'c1' }];

    const aggSpy = jest.spyOn(LogisticsCenter, 'aggregate')
      .mockImplementation(((pipeline: any) => {
        const hasCount = Array.isArray(pipeline) && pipeline.some((st: any) => st.$count);
        return {
          exec: () => Promise.resolve(hasCount ? [{ count: 1 }] : items),
        } as any;
      }) as any);

    // Mock Order.collection.name used inside service
    Object.defineProperty(Order, 'collection', {
      value: { name: 'orders' },
      configurable: true,
    });

    const data = await svc.queryLogisticsCenters(
      { active: true },
      { page: 1, limit: 10, sort: '-createdAt' }
    );

    expect(data.results).toEqual(items);
    expect(data.total).toBe(1);
    expect(aggSpy).toHaveBeenCalled();

    const pipeline = firstArgOf<any[]>(aggSpy);
    expect(Array.isArray(pipeline)).toBe(true);
    expect(pipeline.some(st => st.$lookup)).toBe(true);
    expect(pipeline.some(st => st.$match)).toBe(true);
  });

  it('updateLogisticsCenterById forwards options & returns lean', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const update = { logisticName: 'New' };
    const q: any = {
      select: jest.fn(() => q),
      populate: jest.fn(() => q),
      lean: jest.fn(() => q),
      exec: jest.fn(() => Promise.resolve({ _id: id, logisticName: 'New' })),
    };
    const spy = jest.spyOn(LogisticsCenter, 'findByIdAndUpdate').mockReturnValue(q);

    const out = await svc.updateLogisticsCenterById(id, update, { newDoc: true, populate: true, select: 'logisticName' });
    expect(spy).toHaveBeenCalledWith(id, update, expect.objectContaining({ new: true, runValidators: true }));
    expect(q.select).toHaveBeenCalledWith('logisticName');
    expect(q.populate).toHaveBeenCalled();
    expect(out?._id).toBe(id);
  });

  it('deleteLogisticsCenterById calls findByIdAndDelete', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const spy = jest.spyOn(LogisticsCenter, 'findByIdAndDelete').mockReturnValue({ exec: () => Promise.resolve() } as any);
    await expect(svc.deleteLogisticsCenterById(id)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith(id);
  });

  it('listDeliverersForCenter paginates Deliverer.find/count', async () => {
    const centerId = new mongoose.Types.ObjectId().toString();
    const items = [{ _id: 'd1' }];

    jest.spyOn(DelivererModel, 'find').mockReturnValue({
      sort: () => ({
        skip: () => ({
          limit: () => ({ lean: () => Promise.resolve(items) }),
        }),
      }),
    } as any);
    jest.spyOn(DelivererModel, 'countDocuments').mockResolvedValue(1);

    const out = await svc.listDeliverersForCenter(centerId, { page: 2, limit: 5 });
    expect(out.items).toEqual(items);
    expect(out.page).toBe(2);
    expect(out.limit).toBe(5);
    expect(out.total).toBe(1);
    expect(out.pages).toBe(1);
  });

  it('assignCenterDeliverer wraps ops in a txn and returns both entities', async () => {
    const centerId = new mongoose.Types.ObjectId().toString();
    const delivererId = new mongoose.Types.ObjectId().toString();
    const userId = new mongoose.Types.ObjectId();

    const session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      abortTransaction: jest.fn().mockResolvedValue(undefined),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session as any);

    const dUpdated = { _id: delivererId, user: userId, logisticCenterIds: [centerId] } as any;
    const cUpdated = { _id: centerId, employeeIds: [userId] } as any;

    jest
      .spyOn(DelivererModel, 'findByIdAndUpdate')
      .mockImplementation((() => Promise.resolve(dUpdated)) as any);

    jest
      .spyOn(LogisticsCenter, 'findByIdAndUpdate')
      .mockImplementation((() => Promise.resolve(cUpdated)) as any);

    const out = await svc.assignCenterDeliverer(centerId, delivererId);
    expect(session.commitTransaction).toHaveBeenCalled();
    expect(out).toEqual({ deliverer: dUpdated, center: cUpdated });
  });

  it('unassignCenterDeliverer wraps ops in a txn and returns both entities', async () => {
    const centerId = new mongoose.Types.ObjectId().toString();
    const delivererId = new mongoose.Types.ObjectId().toString();
    const userId = new mongoose.Types.ObjectId();

    const session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      abortTransaction: jest.fn().mockResolvedValue(undefined),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session as any);

    const dUpdated = { _id: delivererId, user: userId, logisticCenterIds: [] } as any;
    const cUpdated = { _id: centerId, employeeIds: [] } as any;

    jest
      .spyOn(DelivererModel, 'findByIdAndUpdate')
      .mockImplementation((() => Promise.resolve(dUpdated)) as any);

    jest
      .spyOn(LogisticsCenter, 'findByIdAndUpdate')
      .mockImplementation((() => Promise.resolve(cUpdated)) as any);

    const out = await svc.unassignCenterDeliverer(centerId, delivererId);
    expect(session.commitTransaction).toHaveBeenCalled();
    expect(out).toEqual({ deliverer: dUpdated, center: cUpdated });
  });
});
