import request from 'supertest';
import app from '../../src/app';

describe('Auth flow (smoke)', () => {
  it('login rejects without creds', async () => {
    const res = await request(app).post('/auth/login').send({});
    // Accept any 4xx as “rejected”
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
