// tests/orders.test.js
const request = require('supertest');
const app     = require('../server');

jest.mock('../config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));
jest.mock('../services/emailService', () => ({
  sendOrderConfirmation: jest.fn().mockResolvedValue(true),
  sendShippingUpdate:    jest.fn().mockResolvedValue(true),
}));
jest.mock('../utils/invoice', () => ({
  generateInvoiceHTML: jest.fn().mockReturnValue('<html>Invoice</html>'),
}));
jest.mock('../middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 1, name: 'Test User', email: 'test@test.com', role: 'customer' };
    next();
  },
  adminOnly: (req, res, next) => next(),
}));

const pool = require('../config/db');

describe('Orders Endpoints', () => {

  describe('POST /api/orders', () => {
    it('rejects empty cart (400/422)', async () => {
      const res = await request(app).post('/api/orders').send({ items: [] });
      expect([400, 422]).toContain(res.status);
    });

    it('rejects invalid item qty (400/422)', async () => {
      const res = await request(app).post('/api/orders')
        .send({ items: [{ id: 1, qty: 0 }] });
      expect([400, 422]).toContain(res.status);
    });

    it('places order successfully', async () => {
      const mockConn = {
        release: jest.fn(),
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 1, title: 'Test Book', price: 15.99, stock: 10 }] }) // book lookup
          .mockResolvedValueOnce({ rows: [{ id: 42 }] })   // insert order
          .mockResolvedValueOnce({ rows: [] })             // insert order_item
          .mockResolvedValueOnce({ rows: [] })             // update stock
          .mockResolvedValueOnce({ rows: [] })             // status history
          .mockResolvedValue({ rows: [] }),                // COMMIT and any subsequent query
      };
      pool.connect.mockResolvedValueOnce(mockConn);
      pool.query.mockResolvedValueOnce({ rows: [{ id: 42, order_number: 'FS-TEST-001', total: 15.99, status: 'confirmed' }] });

      const res = await request(app).post('/api/orders')
        .send({ items: [{ id: 1, qty: 1 }] });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderNumber).toBeDefined();
    });
  });

  describe('GET /api/orders', () => {
    it('returns user order history', async () => {
      pool.query.mockResolvedValueOnce({ rows: [
        {
          order_id: 1, order_number: 'FS-001', status: 'delivered', total: 29.99,
          item_id: 1, title: 'Sapiens', qty: 2, unit_price: 14.99, book_id: 1
        }
      ] });
      const res = await request(app).get('/api/orders');
      expect(res.status).toBe(200);
      expect(res.body.data[0].items).toBeDefined();
    });
  });

  describe('POST /api/orders/validate-coupon', () => {
    it('rejects invalid coupon (404)', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // coupon not found
      const res = await request(app).post('/api/orders/validate-coupon')
        .send({ code: 'FAKECODE', subtotal: 50 });
      expect(res.status).toBe(404);
    });

    it('returns discount for valid coupon', async () => {
      pool.query.mockResolvedValueOnce({ rows: [
        { code: 'SAVE10', type: 'percent', value: 10, min_order: 0 }
      ]});
      const res = await request(app).post('/api/orders/validate-coupon')
        .send({ code: 'SAVE10', subtotal: 50 });
      expect(res.status).toBe(200);
      expect(res.body.data.discount).toBe(5);
    });
  });
});
