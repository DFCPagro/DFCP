import mongoose from 'mongoose';
import * as svc from '../../src/services/deliverer.service';
import Deliverer from '../../src/models/deliverer.model';
import LogisticsCenter from '../../src/models/logisticsCenter.model';
import ApiError from '../../src/utils/ApiError';

function mockSession() {
  return {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    abortTransaction: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn(),
  };
}

describe('deliverer.service center assignments', () => {
  afterEach(() => jest.restoreAllMocks());

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

    const fdSpy = jest.spyOn(Deliverer, 'findByIdAndUpdate').mockResolvedValue(updatedDeliverer);
    const flcSpy = jest.spyOn(LogisticsCenter, 'findByIdAndUpdate').mockResolvedValue({ _id: centerId } as any);

    const out = await svc.assignDelivererToCenter(delivererId, centerId);

    expect(fdSpy).toHaveBeenCalledWith(
      delivererId,
      { $addToSet: { logisticCenterIds: new mongoose.Types.ObjectId(centerId) } },
      expect.objectContaining({ new: true, session })
    );
    expect(flcSpy).toHaveBeenCalledWith(
      centerId,
      { $addToSet: { employeeIds: userId } },
      expect.objectContaining({ session })
    );
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

    const fdSpy = jest.spyOn(Deliverer, 'findByIdAndUpdate').mockResolvedValue(updatedDeliverer);
    const flcSpy = jest.spyOn(LogisticsCenter, 'findByIdAndUpdate').mockResolvedValue({ _id: centerId } as any);

    const out = await svc.unassignDelivererFromCenter(delivererId, centerId);

    expect(fdSpy).toHaveBeenCalledWith(
      delivererId,
      { $pull: { logisticCenterIds: new mongoose.Types.ObjectId(centerId) } },
      expect.objectContaining({ new: true, session })
    );
    expect(flcSpy).toHaveBeenCalledWith(
      centerId,
      { $pull: { employeeIds: userId } },
      expect.objectContaining({ session })
    );
    expect(session.commitTransaction).toHaveBeenCalled();
    expect(out).toEqual(updatedDeliverer);
  });
});
