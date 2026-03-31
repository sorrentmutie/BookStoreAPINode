'use strict';

const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/database');

const API_KEY = process.env.TEST_API_KEY || 'dev-key-1234';
const headers = { 'X-API-Key': API_KEY };

const validBook = {
  title: 'Il Nome della Rosa',
  isbn: '9780156001311',
  author: 'Umberto Eco',
  price: 12.99,
  category: 'Fiction',
};

afterEach(() => {
  db.prepare('DELETE FROM book_genres').run();
  db.prepare('DELETE FROM book_authors').run();
  db.prepare('DELETE FROM books').run();
});

// ---------------------------------------------------------------------------
// POST /api/v1/books
// ---------------------------------------------------------------------------

describe('POST /api/v1/books', () => {
  it('crea un libro con payload valido → 201', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set(headers)
      .send(validBook);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: validBook.title,
      isbn: validBook.isbn,
      author: validBook.author,
      price: validBook.price,
      category: validBook.category,
    });
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('low_stock');
  });

  it('ISBN duplicato → 409 DUPLICATE_ISBN', async () => {
    await request(app).post('/api/v1/books').set(headers).send(validBook);

    const res = await request(app)
      .post('/api/v1/books')
      .set(headers)
      .send({ ...validBook, title: 'Altro Titolo' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_ISBN');
  });

  it('ISBN formato non valido → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set(headers)
      .send({ ...validBook, isbn: '123-INVALID' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('campi obbligatori mancanti → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set(headers)
      .send({ title: 'Solo titolo' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('prezzo negativo → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set(headers)
      .send({ ...validBook, isbn: '9780553293357', price: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('quantita negativa → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set(headers)
      .send({ ...validBook, isbn: '9780553293357', quantity: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('prezzo 0 → 400 VALIDATION_ERROR (price deve essere > 0)', async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set(headers)
      .send({ ...validBook, isbn: '9780553293357', price: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/books
// ---------------------------------------------------------------------------

describe('GET /api/v1/books', () => {
  beforeEach(async () => {
    await request(app).post('/api/v1/books').set(headers).send(validBook);
    await request(app).post('/api/v1/books').set(headers).send({
      title: 'Foundation',
      isbn: '9780553293357',
      author: 'Isaac Asimov',
      price: 9.99,
      category: 'Sci-Fi',
    });
  });

  it('lista paginata con meta { page, limit, total }', async () => {
    const res = await request(app).get('/api/v1/books').set(headers);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20 });
    expect(typeof res.body.meta.total).toBe('number');
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('default page=1 limit=20', async () => {
    const res = await request(app).get('/api/v1/books').set(headers);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.limit).toBe(20);
  });

  it('filtro ?title= (parziale, case-insensitive)', async () => {
    const res = await request(app)
      .get('/api/v1/books?title=foundation')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].title).toBe('Foundation');
  });

  it('flag low_stock presente in ogni libro', async () => {
    const res = await request(app).get('/api/v1/books').set(headers);

    for (const book of res.body.data) {
      expect(book).toHaveProperty('low_stock');
      expect(typeof book.low_stock).toBe('boolean');
    }
  });

  it('sort=price&order=asc', async () => {
    const res = await request(app)
      .get('/api/v1/books?sort=price&order=asc')
      .set(headers);

    expect(res.status).toBe(200);
    const prices = res.body.data.map(b => b.price);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
    }
  });

  it('sort non valido → 400', async () => {
    const res = await request(app)
      .get('/api/v1/books?sort=invalid_column')
      .set(headers);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('limit > 100 → 400', async () => {
    const res = await request(app)
      .get('/api/v1/books?limit=200')
      .set(headers);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/books/:id
// ---------------------------------------------------------------------------

describe('GET /api/v1/books/:id', () => {
  let bookId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set(headers)
      .send(validBook);
    bookId = res.body.data.id;
  });

  it('dettaglio con eager loading (publisher, authors, genres come oggetti)', async () => {
    const res = await request(app).get(`/api/v1/books/${bookId}`).set(headers);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: bookId, title: validBook.title });
    expect(Array.isArray(res.body.data.authors)).toBe(true);
    expect(Array.isArray(res.body.data.genres)).toBe(true);
  });

  it('id inesistente → 404 NOT_FOUND', async () => {
    const res = await request(app).get('/api/v1/books/99999').set(headers);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('id non numerico → 400 VALIDATION_ERROR', async () => {
    const res = await request(app).get('/api/v1/books/abc').set(headers);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/books/:id
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/books/:id', () => {
  let bookId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set(headers)
      .send(validBook);
    bookId = res.body.data.id;
  });

  it('aggiornamento parziale solo dei campi inviati', async () => {
    const res = await request(app)
      .patch(`/api/v1/books/${bookId}`)
      .set(headers)
      .send({ title: 'Titolo Aggiornato' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Titolo Aggiornato');
    expect(res.body.data.isbn).toBe(validBook.isbn);
  });

  it('quantity <= 5 → low_stock: true nella risposta', async () => {
    const res = await request(app).get(`/api/v1/books/${bookId}`).set(headers);
    expect(res.body.data.low_stock).toBe(true);
  });

  it('isbn duplicato → 409 DUPLICATE_ISBN', async () => {
    const otherIsbn = '9780553293357';
    await request(app).post('/api/v1/books').set(headers).send({
      title: 'Foundation',
      isbn: otherIsbn,
      author: 'Isaac Asimov',
      price: 9.99,
      category: 'Sci-Fi',
    });

    const res = await request(app)
      .patch(`/api/v1/books/${bookId}`)
      .set(headers)
      .send({ isbn: otherIsbn });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_ISBN');
  });

  it('body vuoto {} → 200 con dati invariati', async () => {
    const res = await request(app)
      .patch(`/api/v1/books/${bookId}`)
      .set(headers)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe(validBook.title);
    expect(res.body.data.isbn).toBe(validBook.isbn);
  });

  it('id inesistente → 404', async () => {
    const res = await request(app)
      .patch('/api/v1/books/99999')
      .set(headers)
      .send({ title: 'Non esiste' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/books/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/books/:id', () => {
  let bookId;

  beforeEach(async () => {
    const res = await request(app)
      .post('/api/v1/books')
      .set(headers)
      .send(validBook);
    bookId = res.body.data.id;
  });

  it('cancellazione → 204', async () => {
    const res = await request(app)
      .delete(`/api/v1/books/${bookId}`)
      .set(headers);

    expect(res.status).toBe(204);
  });

  it('id inesistente → 404', async () => {
    const res = await request(app).delete('/api/v1/books/99999').set(headers);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
