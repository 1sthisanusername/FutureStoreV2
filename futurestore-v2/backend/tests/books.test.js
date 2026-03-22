// tests/books.test.js
const request = require('supertest');
const app     = require('../server');

jest.mock('../config/db', () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock('../services/searchService', () => ({
  indexBook: jest.fn(), removeBook: jest.fn(), search: jest.fn().mockResolvedValue(null),
}));

const pool = require('../config/db');

describe('Books Endpoints', () => {

  describe('GET /api/books', () => {
    it('returns paginated book list', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ total: 2 }] })
        .mockResolvedValueOnce({ rows: [
          { id: 1, title: 'Book A', author: 'Author A', genre: 'Fiction', price: 12.99, rating: 4.2, is_active: 1 },
          { id: 2, title: 'Book B', author: 'Author B', genre: 'Science', price: 14.99, rating: 4.5, is_active: 1 },
        ]});
      const res = await request(app).get('/api/books');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });

    it('accepts genre filter', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ total: 1 }] }).mockResolvedValueOnce({ rows: [
        { id: 1, title: 'Dune', genre: 'Sci-Fi', price: 14.99 }
      ]});
      const res = await request(app).get('/api/books?genre=Sci-Fi');
      expect(res.status).toBe(200);
      expect(res.body.data[0].genre).toBe('Sci-Fi');
    });

    it('returns empty array when no results', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ total: 0 }] }).mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/books?q=nonexistentbook');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/books/genres', () => {
    it('returns genre list with counts', async () => {
      pool.query.mockResolvedValueOnce({ rows: [
        { genre: 'Fiction', count: 12 },
        { genre: 'Science', count: 8 },
      ]});
      const res = await request(app).get('/api/books/genres');
      expect(res.status).toBe(200);
      expect(res.body.data[0]).toHaveProperty('genre');
      expect(res.body.data[0]).toHaveProperty('count');
    });
  });

  describe('GET /api/books/:id', () => {
    it('returns 404 for unknown book', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // not found
      const res = await request(app).get('/api/books/99999');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns book with reviews and related', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, title: 'Sapiens', genre: 'History', is_active: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 10, rating: 5, comment: 'Great!', reviewer_name: 'Alice' }] })
        .mockResolvedValueOnce({ rows: [{ id: 2, title: 'Guns', genre: 'History' }] });
      const res = await request(app).get('/api/books/1');
      expect(res.status).toBe(200);
      expect(res.body.data.reviews).toBeDefined();
      expect(res.body.data.related).toBeDefined();
    });
  });

  describe('GET /api/books/suggest', () => {
    it('returns suggestions for valid query', async () => {
      pool.query.mockResolvedValueOnce({ rows: [
        { id: 1, title: 'Sapiens', author: 'Harari', genre: 'History' },
      ]});
      const res = await request(app).get('/api/books/suggest?q=sap');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty for short queries', async () => {
      const res = await request(app).get('/api/books/suggest?q=a');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });
  });
});
