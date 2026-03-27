// tests/auth.test.js
const request = require('supertest');

// Mocks MUST come before requiring app
jest.mock('../config/db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  connect: jest.fn(),
}));
jest.mock('../services/searchService', () => ({
  indexBook: jest.fn(), removeBook: jest.fn(), search: jest.fn().mockResolvedValue(null),
}));
jest.mock('../middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 1, name: 'Test User', email: 'test@test.com', role: 'customer' };
    next();
  },
  adminOnly: (req, res, next) => next(),
}));
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
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
}));

// Use resetModules to ensure mocks are applied correctly to the server instance
jest.resetModules();
const app  = require('../server');
const pool = require('../config/db');

beforeEach(() => {
  jest.clearAllMocks();
});

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
    });

    it('rejects invalid CAPTCHA (400)', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); 
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'Jane', email: 'jane@test.com', password: 'Valid@123', captcha: 'wrong' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('rejects invalid email format (422)', async () => {
      const res = await request(app).post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'pass', captcha: 'x' });
      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/auth/me', () => {
    it.skip('returns user profile', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test User' }] });
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Test User');
    });
  });

  describe('PUT /api/auth/change-password', () => {
    it('changes password successfully', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ password_hash: 'old_hash' }] });
      const res = await request(app).put('/api/auth/change-password')
        .send({ currentPassword: 'Password123!', newPassword: 'NewPassword123!' });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/changed/i);
    });

    it('rejects incorrect current password', async () => {
      const bcrypt = require('bcrypt');
      bcrypt.compare.mockResolvedValueOnce(false);
      pool.query.mockResolvedValueOnce({ rows: [{ password_hash: 'old_hash' }] });
      const res = await request(app).put('/api/auth/change-password')
        .send({ currentPassword: 'WrongPassword123!', newPassword: 'NewPassword123!' });
      expect(res.status).toBe(401);
    });
  });
});
