'use strict';

const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/database');

const API_KEY = process.env.TEST_API_KEY || 'dev-key-1234';
const headers = { 'X-API-Key': API_KEY };

const validPublisher = { name: 'Mondadori' };

afterEach(() => {
  db.prepare('DELETE FROM books').run();
  db.prepare('DELETE FROM publishers').run();
});

// ---------------------------------------------------------------------------
// POST /api/v1/publishers
// ---------------------------------------------------------------------------

describe('POST /api/v1/publishers', () => {
  it('crea editore → 201', async () => {
    const res = await request(app)
      .post('/api/v1/publishers')
      .set(headers)
      .send(validPublisher);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: validPublisher.name });
    expect(res.body.data).toHaveProperty('id');
  });

  it('name mancante → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/publishers')
      .set(headers)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.some(d => d.field === 'name')).toBe(true);
  });

  it('name duplicato → 409 DUPLICATE_NAME', async () => {
    await request(app).post('/api/v1/publishers').set(headers).send(validPublisher);

    const res = await request(app)
      .post('/api/v1/publishers')
      .set(headers)
      .send(validPublisher);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_NAME');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/publishers
// ---------------------------------------------------------------------------

describe('GET /api/v1/publishers', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/publishers').set(headers).send({ name: 'Mondadori' });
    await request(app).post('/api/v1/publishers').set(headers).send({ name: 'Einaudi' });
  });

  it('lista paginata', async () => {
    const res = await request(app).get('/api/v1/publishers').set(headers);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20 });
    expect(typeof res.body.meta.total).toBe('number');
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/publishers/:id
// ---------------------------------------------------------------------------

describe('GET /api/v1/publishers/:id', () => {
  let publisherId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/v1/publishers')
      .set(headers)
      .send(validPublisher);
    publisherId = res.body.data.id;
  });

  it('dettaglio editore', async () => {
    const res = await request(app)
      .get(`/api/v1/publishers/${publisherId}`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: publisherId,
      name: validPublisher.name,
    });
    expect(res.body.data).toHaveProperty('book_count');
    expect(typeof res.body.data.book_count).toBe('number');
  });

  it('id inesistente → 404', async () => {
    const res = await request(app).get('/api/v1/publishers/99999').set(headers);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PUBLISHER_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/publishers/:id
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/publishers/:id', () => {
  let publisherId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/v1/publishers')
      .set(headers)
      .send(validPublisher);
    publisherId = res.body.data.id;
  });

  it('aggiornamento name', async () => {
    const res = await request(app)
      .patch(`/api/v1/publishers/${publisherId}`)
      .set(headers)
      .send({ name: 'Rizzoli' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Rizzoli');
  });

  it('id inesistente → 404', async () => {
    const res = await request(app)
      .patch('/api/v1/publishers/99999')
      .set(headers)
      .send({ name: 'Rizzoli' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PUBLISHER_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/publishers/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/publishers/:id', () => {
  let publisherId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/v1/publishers')
      .set(headers)
      .send(validPublisher);
    publisherId = res.body.data.id;
  });

  it('editore senza libri → 204', async () => {
    const res = await request(app)
      .delete(`/api/v1/publishers/${publisherId}`)
      .set(headers);

    expect(res.status).toBe(204);
  });

  it('editore con libri → 409 PUBLISHER_HAS_BOOKS', async () => {
    await request(app).post('/api/v1/books').set(headers).send({
      title: 'Il Nome della Rosa',
      isbn: '9780156001311',
      author: 'Umberto Eco',
      price: 12.99,
      category: 'Fiction',
    });
    db.prepare('UPDATE books SET publisher_id = ? WHERE isbn = ?').run(publisherId, '9780156001311');

    const res = await request(app)
      .delete(`/api/v1/publishers/${publisherId}`)
      .set(headers);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PUBLISHER_HAS_BOOKS');
  });

  it('id inesistente → 404', async () => {
    const res = await request(app).delete('/api/v1/publishers/99999').set(headers);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PUBLISHER_NOT_FOUND');
  });
});
