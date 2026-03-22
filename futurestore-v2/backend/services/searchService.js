// services/searchService.js — Algolia full-text search integration
// Install: npm install algoliasearch
// Set ALGOLIA_APP_ID + ALGOLIA_API_KEY in .env
// Falls back to MySQL LIKE search if Algolia not configured

let algoliaClient = null;
let algoliaIndex  = null;

try {
  const algoliasearch = require('algoliasearch');
  if (process.env.ALGOLIA_APP_ID && process.env.ALGOLIA_API_KEY) {
    algoliaClient = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_API_KEY);
    algoliaIndex  = algoliaClient.initIndex(process.env.ALGOLIA_INDEX || 'books');
    console.log('🔍  Algolia search enabled');
  }
} catch (_) {}

// ── Sync Hooks ────────────────────────────────────────────────────

const indexBook = async (book) => {
  if (!algoliaIndex) return;
  await algoliaIndex.saveObject({
    objectID: String(book.id),
    title:    book.title,
    author:   book.author,
    genre:    book.genre,
    price:    book.price,
    rating:   book.rating,
    badge:    book.badge,
    stock:    book.stock,
    cover_color: book.cover_color,
  });
};

const removeBook = async (bookId) => {
  if (!algoliaIndex) return;
  await algoliaIndex.deleteObject(String(bookId));
};

// ── Search ────────────────────────────────────────────────────────

const search = async (query, filters = {}) => {
  if (!algoliaIndex) return null; // caller falls back to MySQL

  const algoliaFilters = [];
  if (filters.genre)     algoliaFilters.push(`genre:"${filters.genre}"`);
  if (filters.minPrice)  algoliaFilters.push(`price >= ${filters.minPrice}`);
  if (filters.maxPrice)  algoliaFilters.push(`price <= ${filters.maxPrice}`);
  if (filters.minRating) algoliaFilters.push(`rating >= ${filters.minRating}`);

  const result = await algoliaIndex.search(query, {
    filters: algoliaFilters.join(' AND '),
    hitsPerPage: filters.limit || 20,
    page: (filters.page || 1) - 1,
    attributesToRetrieve: ['objectID','title','author','genre','price','rating','badge','cover_color'],
  });

  return {
    hits:  result.hits.map(h => ({ ...h, id: parseInt(h.objectID) })),
    total: result.nbHits,
    pages: result.nbPages,
  };
};

module.exports = { indexBook, removeBook, search };
