// tests/auth.test.js
const request = require('supertest');
const app     = require('../server');

// Mock DB pool so tests don't need a real MySQL connection
jest.mock('../config/db', () => {
  const mockPool = {
    query: jest.fn(),
    connect: jest.fn(),
  };
  return mockPool;
});
jest.mock('../services/emailService', () => ({
  sendWelcome: jest.fn().mockResolvedValue(true),
  sendEmailVerification: jest.fn().mockResolvedValue(true),
  sendPasswordReset: jest.fn().mockResolvedValue(true),
}));
jest.mock('../utils/jwt', () => ({
  signAccess:         jest.fn().mockReturnValue('mock-access-token'),
  signRefresh:        jest.fn().mockReturnValue('mock-refresh-token'),
  storeRefreshToken:  jest.fn().mockResolvedValue(true),
  rotateRefreshToken: jest.fn().mockResolvedValue('mock-refresh-token'),
  revokeAllTokens:    jest.fn().mockResolvedValue(true),
}));

const pool = require('../config/db');

describe('Auth Endpoints', () => {

  describe('GET /api/auth/captcha', () => {
    it('returns SVG image', async () => {
      const res = await request(app).get('/api/auth/captcha');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/svg/);
    });
  });

  describe('POST /api/auth/register', () => {
    it('rejects missing fields (422)', async () => {
      const res = await request(app).post('/api/auth/register').send({});
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('rejects weak password (422)', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Test', email: 'test@test.com', password: 'weak', captcha: 'abc'
      });
      expect(res.status).toBe(422);
    });

    it('rejects invalid CAPTCHA (400)', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // no existing user
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Jane', email: 'jane@test.com', password: 'Valid@123', captcha: 'wrong' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/captcha/i);
    });
  });

  describe('POST /api/auth/login', () => {
    it('rejects invalid email format (422)', async () => {
      const res = await request(app).post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'pass', captcha: 'x' });
      expect(res.status).toBe(422);
    });

    it('rejects missing password (422)', async () => {
      const res = await request(app).post('/api/auth/login')
        .send({ email: 'user@test.com', captcha: 'x' });
      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('returns success even for unknown email (anti-enumeration)', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // user not found
      const res = await request(app).post('/api/auth/forgot-password')
        .send({ email: 'unknown@test.com' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });
});
