import request from 'supertest';
import app from '../../src/app';

describe('App', () => {
  it('returns 404 on unknown route', async () => {
    const res = await request(app).get('/__nope__');
    expect([404, 400]).toContain(res.status);
  });
});
