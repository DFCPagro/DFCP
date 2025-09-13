import request from 'supertest';
import app from '../setup/test-app';
import { createUser, signAccess } from '../setup/test-auth';
import LogisticsCenter from '../../src/models/logisticsCenter.model';
import { Deliverer as DelivererModel } from '../../src/models/deliverer.model';

const API = process.env.API_PREFIX || '/api/v1';

describe('Deliverer API', () => {
  let adminToken: string;
  let managerToken: string;
  let delivererUser: any;
  let center: any;
  let delivererId: string;

  beforeAll(async () => {
    const admin = await createUser('admin');
    const dManager = await createUser('dManager');
    adminToken = `Bearer ${signAccess(String(admin._id))}`;
    managerToken = `Bearer ${signAccess(String(dManager._id))}`;

    delivererUser = await createUser('deliverer', { uid: 'DLV-T1' });

    center = await LogisticsCenter.create({
      logisticName: 'Center A',
      location: { name: 'TLV', geo: { type: 'Point', coordinates: [34.78, 32.08] } },
      employeeIds: [],
      deliveryHistory: [],
    });
  });

  it('creates deliverer (admin)', async () => {
    const res = await request(app)
      .post(`${API}/deliverers`)
      .set('Authorization', adminToken)
      .send({
        user: String(delivererUser._id),
        licenseType: 'B',
        driverLicenseNumber: 'DL-12345',
        vehicleMake: 'Ford',
      })
      .expect(201);

    delivererId = res.body._id;
    expect(res.body.user).toBe(String(delivererUser._id));
  });

  it('reads deliverer (manager)', async () => {
    const res = await request(app)
      .get(`${API}/deliverers/${delivererId}`)
      .set('Authorization', managerToken)
      .expect(200);

    expect(res.body._id).toBe(delivererId);
  });

  it('assigns center & syncs LC.employeeIds', async () => {
    const res = await request(app)
      .post(`${API}/deliverers/${delivererId}/centers/${center._id}`)
      .set('Authorization', managerToken)
      .expect(200);

    expect(res.body.logisticCenterIds).toContain(String(center._id));
    const lc = await LogisticsCenter.findById(center._id).lean();
    expect(lc?.employeeIds.map(String)).toContain(String(delivererUser._id));
  });

  it('sets activeSchedule', async () => {
    // jest.setup pinned date to 2025-09-01 => 30 days in month
    const schedule = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? 1 : 0));
    const res = await request(app)
      .patch(`${API}/deliverers/${delivererId}/schedule`)
      .set('Authorization', managerToken)
      .send({ activeSchedule: schedule })
      .expect(200);

    expect(res.body.activeSchedule.length).toBe(30);
    expect(res.body.activeSchedule[0]).toBe(1);
    expect(res.body.activeSchedule[1]).toBe(0);
  });

  it('toggle a day bit (evening=4) on day index 2', async () => {
    const res = await request(app)
      .patch(`${API}/deliverers/${delivererId}/schedule/day`)
      .set('Authorization', managerToken)
      .send({ dayIndex: 2, shiftMask: 4, enabled: true })
      .expect(200);

    expect(res.body.activeSchedule[2] & 4).toBe(4);
  });

  it('availability check returns true for day 2 + morning(1)', async () => {
    const res = await request(app)
      .get(`${API}/deliverers/${delivererId}/availability?dayIndex=2&shiftMask=1`)
      .set('Authorization', managerToken)
      .expect(200);

    expect(res.body.available).toBe(true);
  });

  it('set nextSchedule & advance month', async () => {
    const next = Array.from({ length: 30 }, () => 5); // 1+4 (morning+evening)
    await request(app)
      .patch(`${API}/deliverers/${delivererId}/next-schedule`)
      .set('Authorization', managerToken)
      .send({ nextSchedule: next })
      .expect(200);

    const res = await request(app)
      .post(`${API}/deliverers/${delivererId}/advance-month`)
      .set('Authorization', managerToken)
      .send({ applyNext: true })
      .expect(200);

    expect(res.body.activeSchedule.every((v: number) => v === 5)).toBe(true);
    expect(res.body.nextSchedule.length).toBe(0);
  });

  it('deletes deliverer (admin)', async () => {
    await request(app)
      .delete(`${API}/deliverers/${delivererId}`)
      .set('Authorization', adminToken)
      .expect(204);

    const gone = await DelivererModel.findById(delivererId).lean();
    expect(gone).toBeNull();
  });
});
