import request from 'supertest';
import app from '../setup/test-app';
import { seedCenters } from '../setup/test-seed';
import { createUser, signAccess } from '../setup/test-auth';

const API = process.env.API_PREFIX || '/api/v1';

describe('LogisticsCenter API', () => {
  let adminToken: string;
  let dManagerToken: string;
  let opManagerToken: string;
  let centers: any[];

  beforeAll(async () => {
    const admin = await createUser('admin');
    const dManager = await createUser('dManager');
    const opManager = await createUser('opManager');

    adminToken = `Bearer ${signAccess(String(admin._id))}`;
    dManagerToken = `Bearer ${signAccess(String(dManager._id))}`;
    opManagerToken = `Bearer ${signAccess(String(opManager._id))}`;

    centers = await seedCenters();
  });

  it('lists centers for any authenticated user', async () => {
    const res = await request(app)
      .get(`${API}/logistics-centers`)
      .set('Authorization', adminToken)
      .expect(200);

    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBeGreaterThan(0);
  });

  it('filters centers by $near geospatial', async () => {
    const res = await request(app)
      .get(`${API}/logistics-centers?nearLng=34.78&nearLat=32.08&maxMeters=6000`)
      .set('Authorization', adminToken)
      .expect(200);

    const names = res.body.results.map((c: any) => c.logisticName);
    expect(names).toContain('Tel Aviv Logistics Center');
  });

  it('creates a center (manager/admin)', async () => {
    const res = await request(app)
      .post(`${API}/logistics-centers`)
      .set('Authorization', dManagerToken)
      .send({ logisticName: 'Haifa LC', location: { name: 'Haifa' } })
      .expect(201);

    expect(res.body._id).toBeDefined();
    expect(res.body.logisticName).toBe('Haifa LC');
  });

  it('updates a center (manager roles)', async () => {
    const id = centers[0]._id;
    const res = await request(app)
      .patch(`${API}/logistics-centers/${id}`)
      .set('Authorization', opManagerToken)
      .send({ logisticName: 'TA LC' })
      .expect(200);

    expect(res.body.logisticName).toBe('TA LC');
  });

  it('appends delivery-history (manager roles)', async () => {
    const id = centers[0]._id;
    const res = await request(app)
      .post(`${API}/logistics-centers/${id}/delivery-history`)
      .set('Authorization', opManagerToken)
      .send({ entry: 'Loaded 3 pallets' })
      .expect(200);

    const last = res.body.deliveryHistory.at(-1);
    expect(last.message).toBe('Loaded 3 pallets');
  });

  it('deletes a center (opManager/admin)', async () => {
    const created = await request(app)
      .post(`${API}/logistics-centers`)
      .set('Authorization', adminToken)
      .send({ logisticName: 'To Delete', location: { name: 'Somewhere' } })
      .expect(201);

    await request(app)
      .delete(`${API}/logistics-centers/${created.body._id}`)
      .set('Authorization', opManagerToken)
      .expect(204);
  });
});
