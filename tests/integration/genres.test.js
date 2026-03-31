'use strict';

const request = require('supertest');
const app = require('../../src/app');

const API_KEY = process.env.TEST_API_KEY || 'dev-key-1234';
const headers = { 'X-API-Key': API_KEY };

// I generi sono pre-seeded e non vengono toccati tra i test.

// ---------------------------------------------------------------------------
// GET /api/v1/genres
// ---------------------------------------------------------------------------

describe('GET /api/v1/genres', () => {
  it('lista completa non paginata con 11 generi', async () => {
    const res = await request(app).get('/api/v1/genres').set(headers);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(11);
    expect(res.body.data[0]).toHaveProperty('id');
    expect(res.body.data[0]).toHaveProperty('name');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/genres/:id
// ---------------------------------------------------------------------------

describe('GET /api/v1/genres/:id', () => {
  it('dettaglio genere esistente', async () => {
    const res = await request(app).get('/api/v1/genres/1').set(headers);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('id', 1);
    expect(res.body.data).toHaveProperty('name');
    expect(res.body.data).toHaveProperty('book_count');
    expect(typeof res.body.data.book_count).toBe('number');
  });

  it('id inesistente → 404', async () => {
    const res = await request(app).get('/api/v1/genres/99999').set(headers);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('GENRE_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// Genres sola lettura
// ---------------------------------------------------------------------------

describe('Genres sola lettura', () => {
  it('POST /api/v1/genres → 405 METHOD_NOT_ALLOWED', async () => {
    const res = await request(app)
      .post('/api/v1/genres')
      .set(headers)
      .send({ name: 'New Genre' });

    expect(res.status).toBe(405);
    expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('PATCH /api/v1/genres/1 → 405 METHOD_NOT_ALLOWED', async () => {
    const res = await request(app)
      .patch('/api/v1/genres/1')
      .set(headers)
      .send({ name: 'Updated' });

    expect(res.status).toBe(405);
    expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('DELETE /api/v1/genres/1 → 405 METHOD_NOT_ALLOWED', async () => {
    const res = await request(app).delete('/api/v1/genres/1').set(headers);

    expect(res.status).toBe(405);
    expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
  });
});

// ---------------------------------------------------------------------------
// Autenticazione
// ---------------------------------------------------------------------------

describe('Autenticazione', () => {
  it('richiesta senza X-API-Key → 401 MISSING_API_KEY', async () => {
    const res = await request(app).get('/api/v1/genres');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_API_KEY');
  });

  it('richiesta con API Key non valida → 401 INVALID_API_KEY', async () => {
    const res = await request(app)
      .get('/api/v1/genres')
      .set('X-API-Key', 'invalid-key-xyz');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_API_KEY');
  });
});
