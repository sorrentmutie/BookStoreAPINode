'use strict';

const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/database');

const API_KEY = process.env.TEST_API_KEY || 'dev-key-1234';
const headers = { 'X-API-Key': API_KEY };

const validAuthor = {
  first_name: 'Umberto',
  last_name: 'Eco',
  nationality: 'Italian',
  biography: 'Italian novelist and philosopher.',
};

afterEach(() => {
  db.prepare('DELETE FROM book_authors').run();
  db.prepare('DELETE FROM books').run();
  db.prepare('DELETE FROM authors').run();
});

// ---------------------------------------------------------------------------
// POST /api/v1/authors
// ---------------------------------------------------------------------------

describe('POST /api/v1/authors', () => {
  it('crea autore con payload valido → 201', async () => {
    const res = await request(app)
      .post('/api/v1/authors')
      .set(headers)
      .send(validAuthor);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      first_name: validAuthor.first_name,
      last_name: validAuthor.last_name,
      nationality: validAuthor.nationality,
    });
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('created_at');
  });

  it('first_name mancante → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/authors')
      .set(headers)
      .send({ last_name: 'Eco' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.some(d => d.field === 'first_name')).toBe(true);
  });

  it('last_name mancante → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/authors')
      .set(headers)
      .send({ first_name: 'Umberto' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.some(d => d.field === 'last_name')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/authors
// ---------------------------------------------------------------------------

describe('GET /api/v1/authors', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/authors').set(headers).send(validAuthor);
    await request(app).post('/api/v1/authors').set(headers).send({
      first_name: 'Isaac',
      last_name: 'Asimov',
      nationality: 'American',
    });
  });

  it('lista paginata con meta', async () => {
    const res = await request(app).get('/api/v1/authors').set(headers);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20 });
    expect(typeof res.body.meta.total).toBe('number');
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/authors/:id
// ---------------------------------------------------------------------------

describe('GET /api/v1/authors/:id', () => {
  let authorId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/v1/authors')
      .set(headers)
      .send(validAuthor);
    authorId = res.body.data.id;
  });

  it('dettaglio autore', async () => {
    const res = await request(app)
      .get(`/api/v1/authors/${authorId}`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: authorId,
      first_name: validAuthor.first_name,
      last_name: validAuthor.last_name,
    });
    expect(Array.isArray(res.body.data.books)).toBe(true);
  });

  it('id inesistente → 404', async () => {
    const res = await request(app).get('/api/v1/authors/99999').set(headers);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('AUTHOR_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/authors/:id
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/authors/:id', () => {
  let authorId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/v1/authors')
      .set(headers)
      .send(validAuthor);
    authorId = res.body.data.id;
  });

  it('aggiornamento parziale', async () => {
    const res = await request(app)
      .patch(`/api/v1/authors/${authorId}`)
      .set(headers)
      .send({ nationality: 'French' });

    expect(res.status).toBe(200);
    expect(res.body.data.nationality).toBe('French');
    expect(res.body.data.first_name).toBe(validAuthor.first_name);
  });

  it('id inesistente → 404', async () => {
    const res = await request(app)
      .patch('/api/v1/authors/99999')
      .set(headers)
      .send({ nationality: 'French' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('AUTHOR_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/authors/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/authors/:id', () => {
  let authorId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/v1/authors')
      .set(headers)
      .send(validAuthor);
    authorId = res.body.data.id;
  });

  it('autore senza libri → 204', async () => {
    const res = await request(app)
      .delete(`/api/v1/authors/${authorId}`)
      .set(headers);

    expect(res.status).toBe(204);
  });

  it('autore con libri → 409 AUTHOR_HAS_BOOKS', async () => {
    const bookRes = await request(app)
      .post('/api/v1/books')
      .set(headers)
      .send({
        title: 'Il Nome della Rosa',
        isbn: '9780156001311',
        author: 'Umberto Eco',
        price: 12.99,
        category: 'Fiction',
      });
    const bookId = bookRes.body.data.id;
    db.prepare('INSERT INTO book_authors (book_id, author_id) VALUES (?, ?)').run(bookId, authorId);

    const res = await request(app)
      .delete(`/api/v1/authors/${authorId}`)
      .set(headers);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('AUTHOR_HAS_BOOKS');
  });

  it('id inesistente → 404', async () => {
    const res = await request(app).delete('/api/v1/authors/99999').set(headers);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('AUTHOR_NOT_FOUND');
  });
});
