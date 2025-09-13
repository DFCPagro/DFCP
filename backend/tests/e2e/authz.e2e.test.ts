import request from 'supertest';
import app from '../setup/test-app';

const API = process.env.API_PREFIX || '/api/v1';

describe('Auth basics', () => {
  it('401 when no token', async () => {
    await request(app).get(`${API}/logistics-centers`).expect(401);
  });
});
