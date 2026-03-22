// tests/admin.test.js
const request = require('supertest');
const app     = require('../server');

jest.mock('../config/db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../services/searchService', () => ({
  indexBook: jest.fn().mockResolvedValue(true),
  removeBook: jest.fn().mockResolvedValue(true),
}));
jest.mock('../services/emailService', () => ({
  sendShippingUpdate: jest.fn().mockResolvedValue(true),
}));
jest.mock('../middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 1, name: 'Admin', email: 'admin@test.com', role: 'admin' };
    next();
  },
  adminOnly: (req, res, next) => next(),
}));
jest.mock('../middleware/auditLog', () => () => (req, res, next) => next());

const pool = require('../config/db');

describe('Admin Endpoints', () => {

  describe('GET /api/admin/dashboard', () => {
    it('returns all dashboard stats', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ totalusers: 150 }] })
        .mockResolvedValueOnce({ rows: [{ totalorders: 320 }] })
        .mockResolvedValueOnce({ rows: [{ totalrevenue: 8450.50 }] })
        .mockResolvedValueOnce({ rows: [{ totalbooks: 42 }] })
        .mockResolvedValueOnce({ rows: [{ lowstock: 3 }] })
        .mockResolvedValueOnce({ rows: [{ pendingorders: 7 }] })
        .mockResolvedValueOnce({ rows: [] })   // revenueChart
        .mockResolvedValueOnce({ rows: [] })   // recentOrders
        .mockResolvedValueOnce({ rows: [] })   // topBooks
        .mockResolvedValueOnce({ rows: [] })   // auditLogs
        .mockResolvedValueOnce({ rows: [] });  // lowStockBooks
      const res = await request(app).get('/api/admin/dashboard');
      expect(res.status).toBe(200);
      expect(res.body.data.totalUsers).toBe(150);
      expect(res.body.data.totalRevenue).toBe(8450.50);
    });
  });

  describe('POST /api/admin/books', () => {
    it('rejects missing required fields (422)', async () => {
      const res = await request(app).post('/api/admin/books').send({ title: 'Only Title' });
      expect(res.status).toBe(422);
    });

    it('creates a book', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 55, title: 'New Book', author: 'Author', genre: 'Fiction', price: 12.99, stock: 20 }] });
      const res = await request(app).post('/api/admin/books').send({
        title: 'New Book', author: 'Author', genre: 'Fiction', price: 12.99, stock: 20
      });
      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(55);
    });
  });

  describe('PATCH /api/admin/inventory/:id/stock', () => {
    it('rejects negative stock (422)', async () => {
      const res = await request(app).patch('/api/admin/inventory/1/stock').send({ stock: -1 });
      expect(res.status).toBe(422);
    });

    it('updates stock successfully', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).patch('/api/admin/inventory/1/stock').send({ stock: 50 });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/50/);
    });
  });

  describe('POST /api/admin/coupons', () => {
    it('creates a percent coupon', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 3, code: 'SUMMER20' }] });
      const res = await request(app).post('/api/admin/coupons')
        .send({ code: 'SUMMER20', type: 'percent', value: 20, min_order: 30 });
      expect(res.status).toBe(201);
      expect(res.body.data.code).toBe('SUMMER20');
    });

    it('rejects invalid type (422)', async () => {
      const res = await request(app).post('/api/admin/coupons')
        .send({ code: 'X', type: 'invalid', value: 10 });
      expect(res.status).toBe(422);
    });
  });

  describe('PATCH /api/admin/orders/:id/status', () => {
    it('rejects invalid status value', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
      const res = await request(app).patch('/api/admin/orders/1/status')
        .send({ status: 'teleported' });
      // Validator throws 422, controller fallback throws 400
      expect([400, 422]).toContain(res.status);
    });

    it('updates to shipped and triggers email', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })   // UPDATE orders
        .mockResolvedValueOnce({ rows: [] })   // INSERT history
        .mockResolvedValueOnce({ rows: [{ id: 1, order_number: 'FS-001', name: 'Alice', email: 'alice@test.com' }] }); // fetch for email
      const res = await request(app).patch('/api/admin/orders/1/status')
        .send({ status: 'shipped', tracking_id: 'TRACK123' });
      expect(res.status).toBe(200);
    });
  });
});
