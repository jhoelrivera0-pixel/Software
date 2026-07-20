const request = require('supertest');
const { app } = require('../server'); 

describe('API Endpoints', () => {
  it('should return 401 for /api/products if not authenticated', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toEqual(401);
  });

  it('should return 401 for /api/suppliers if not authenticated', async () => {
    const res = await request(app).get('/api/suppliers');
    expect(res.statusCode).toEqual(401);
  });
});
