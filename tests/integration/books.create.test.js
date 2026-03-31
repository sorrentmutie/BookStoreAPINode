'use strict';

/**
 * Test di integrazione: POST /api/v1/books
 *
 * Modello semplificato: title, isbn (ISBN-13), author (stringa),
 * price (> 0), category (enum).
 */

const request = require('supertest');
const app     = require('../../src/app');
const db      = require('../../src/database');

const API_KEY = process.env.TEST_API_KEY || 'dev-key-1234';
const auth    = { 'X-API-Key': API_KEY };

const VALID_PAYLOAD = {
  title:    'Il nome della rosa',
  isbn:     '978-3-16-148410-0',
  author:   'Umberto Eco',
  price:    19.90,
  category: 'Fiction',
};

describe('POST /api/v1/books', () => {
  afterEach(() => {
    // Pulizia dopo ogni test per isolamento
    db.prepare('DELETE FROM books').run();
  });

  // ---------------------------------------------------------------------------
  // 1. Payload valido → 201
  // ---------------------------------------------------------------------------

  it('payload valido → 201, Location header, body { data: { id, title, isbn, author, price, category } }', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set(auth)
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.headers['location']).toMatch(/\/api\/v1\/books\/\d+/);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toMatchObject({
      title:    VALID_PAYLOAD.title,
      isbn:     VALID_PAYLOAD.isbn,
      author:   VALID_PAYLOAD.author,
      price:    VALID_PAYLOAD.price,
      category: VALID_PAYLOAD.category,
    });
    expect(typeof res.body.data.id).toBe('number');
  });

  // ---------------------------------------------------------------------------
  // 2. title mancante → 400 VALIDATION_ERROR
  // ---------------------------------------------------------------------------

  it('title mancante → 400 VALIDATION_ERROR con field title', async () => {
    const { title, ...payload } = VALID_PAYLOAD;

    const res = await request(app)
      .post('/api/v1/books')
      .set(auth)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map(d => d.field);
    expect(fields).toContain('title');
  });

  // ---------------------------------------------------------------------------
  // 3. isbn mancante → 400 VALIDATION_ERROR
  // ---------------------------------------------------------------------------

  it('isbn mancante → 400 VALIDATION_ERROR con field isbn', async () => {
    const { isbn, ...payload } = VALID_PAYLOAD;

    const res = await request(app)
      .post('/api/v1/books')
      .set(auth)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map(d => d.field);
    expect(fields).toContain('isbn');
  });

  // ---------------------------------------------------------------------------
  // 4. isbn formato non valido → 400 VALIDATION_ERROR
  // ---------------------------------------------------------------------------

  it('isbn formato non valido → 400 VALIDATION_ERROR con field isbn', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set(auth)
      .send({ ...VALID_PAYLOAD, isbn: 'not-an-isbn' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map(d => d.field);
    expect(fields).toContain('isbn');
  });

  // ---------------------------------------------------------------------------
  // 5. author mancante → 400 VALIDATION_ERROR
  // ---------------------------------------------------------------------------

  it('author mancante → 400 VALIDATION_ERROR con field author', async () => {
    const { author, ...payload } = VALID_PAYLOAD;

    const res = await request(app)
      .post('/api/v1/books')
      .set(auth)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map(d => d.field);
    expect(fields).toContain('author');
  });

  // ---------------------------------------------------------------------------
  // 6. price: 0 → 400 VALIDATION_ERROR (deve essere > 0)
  // ---------------------------------------------------------------------------

  it('price: 0 → 400 VALIDATION_ERROR (price deve essere > 0)', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set(auth)
      .send({ ...VALID_PAYLOAD, price: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map(d => d.field);
    expect(fields).toContain('price');
  });

  // ---------------------------------------------------------------------------
  // 7. price: -5 → 400 VALIDATION_ERROR
  // ---------------------------------------------------------------------------

  it('price: -5 → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set(auth)
      .send({ ...VALID_PAYLOAD, price: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map(d => d.field);
    expect(fields).toContain('price');
  });

  // ---------------------------------------------------------------------------
  // 8. category non valida → 400 VALIDATION_ERROR
  // ---------------------------------------------------------------------------

  it('category non valida (Comics) → 400 VALIDATION_ERROR con field category', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set(auth)
      .send({ ...VALID_PAYLOAD, category: 'Comics' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map(d => d.field);
    expect(fields).toContain('category');
  });

  // ---------------------------------------------------------------------------
  // 9. category mancante → 400 VALIDATION_ERROR
  // ---------------------------------------------------------------------------

  it('category mancante → 400 VALIDATION_ERROR con field category', async () => {
    const { category, ...payload } = VALID_PAYLOAD;

    const res = await request(app)
      .post('/api/v1/books')
      .set(auth)
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map(d => d.field);
    expect(fields).toContain('category');
  });

  // ---------------------------------------------------------------------------
  // 10. ISBN duplicato → 409 DUPLICATE_ISBN
  // ---------------------------------------------------------------------------

  it('ISBN duplicato → 409 con error.code DUPLICATE_ISBN', async () => {
    // Prima creazione: deve riuscire
    const first = await request(app)
      .post('/api/v1/books')
      .set(auth)
      .send(VALID_PAYLOAD);
    expect(first.status).toBe(201);

    // Seconda creazione con stesso ISBN
    const second = await request(app)
      .post('/api/v1/books')
      .set(auth)
      .send({ ...VALID_PAYLOAD, title: 'Altro titolo' });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('DUPLICATE_ISBN');
  });

  // ---------------------------------------------------------------------------
  // 11. Senza X-API-Key → 401
  // ---------------------------------------------------------------------------

  it('richiesta senza X-API-Key → 401', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(401);
  });

  // ---------------------------------------------------------------------------
  // 12. Più errori di validazione contemporaneamente
  // ---------------------------------------------------------------------------

  it('più errori di validazione → 400 con details array con più elementi', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set(auth)
      .send({
        isbn:  'bad',
        price: -1,
        // title, author, category mancanti
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThan(1);
  });
});
