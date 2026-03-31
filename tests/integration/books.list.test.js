'use strict';

/**
 * Test di integrazione: GET /api/v1/books
 *
 * Copre i task T002-T006 (repository list + controller list).
 * Usa un DB in-memory condiviso con l'istanza di app (stesso processo Jest).
 */

const request = require('supertest');
const app     = require('../../src/app');
const db      = require('../../src/database');

const API_KEY = process.env.TEST_API_KEY || 'dev-key-1234';
const auth    = { 'X-API-Key': API_KEY };

// ---------------------------------------------------------------------------
// Helpers fixture
// ---------------------------------------------------------------------------

function insertPublisher(name) {
  return db.prepare('INSERT INTO publishers (name) VALUES (?)').run(name).lastInsertRowid;
}

function insertAuthor(first, last) {
  return db.prepare('INSERT INTO authors (first_name, last_name) VALUES (?, ?)').run(first, last).lastInsertRowid;
}

function getGenreId(name) {
  return db.prepare('SELECT id FROM genres WHERE name = ?').get(name).id;
}

function insertBook({ title, isbn, price = 10, quantity = 5, publication_year = 2020, publisher_id }) {
  return db.prepare(`
    INSERT INTO books (title, isbn, price, quantity, publication_year, publisher_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title, isbn, price, quantity, publication_year, publisher_id).lastInsertRowid;
}

function linkAuthor(book_id, author_id) {
  db.prepare('INSERT INTO book_authors (book_id, author_id) VALUES (?, ?)').run(book_id, author_id);
}

function linkGenre(book_id, genre_id) {
  db.prepare('INSERT INTO book_genres (book_id, genre_id) VALUES (?, ?)').run(book_id, genre_id);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('GET /api/v1/books', () => {
  let pubId;
  let authorId;
  let genreId;
  let bookId1;
  let bookId2;
  let bookId3;

  beforeAll(() => {
    // Pulizia preventiva per isolamento
    db.prepare('DELETE FROM books').run();
    db.prepare('DELETE FROM publishers').run();
    db.prepare('DELETE FROM authors').run();

    pubId    = insertPublisher('Mondadori');
    authorId = insertAuthor('Mario', 'Rossi');
    genreId  = getGenreId('Sci-Fi');

    // Libro 1: disponibile, con autore e genere
    bookId1 = insertBook({ title: 'Dune', isbn: '0306406152', price: 20, quantity: 10, publication_year: 1965, publisher_id: pubId });
    linkAuthor(bookId1, authorId);
    linkGenre(bookId1, genreId);

    // Libro 2: disponibile, con autore, senza genere Sci-Fi
    bookId2 = insertBook({ title: 'Foundation', isbn: '0306406160', price: 18, quantity: 3, publication_year: 1951, publisher_id: pubId });
    linkAuthor(bookId2, authorId);

    // Libro 3: non disponibile (quantity=0)
    bookId3 = insertBook({ title: 'Out of Print', isbn: '0306406179', price: 5, quantity: 0, publication_year: 2000, publisher_id: pubId });
  });

  afterAll(() => {
    db.prepare('DELETE FROM books').run();
    db.prepare('DELETE FROM publishers').run();
    db.prepare('DELETE FROM authors').run();
  });

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it('richiesta senza X-API-Key → 401', async () => {
    const res = await request(app).get('/api/v1/books');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toMatch(/MISSING_API_KEY|INVALID_API_KEY/);
  });

  // -------------------------------------------------------------------------
  // Lista base
  // -------------------------------------------------------------------------

  it('lista tutti i libri → 200 con data e meta', async () => {
    const res = await request(app)
      .get('/api/v1/books')
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('meta');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 3 });
  });

  it('ogni libro nella risposta ha il campo low_stock', async () => {
    const res = await request(app)
      .get('/api/v1/books')
      .set(auth);

    expect(res.status).toBe(200);
    res.body.data.forEach(book => {
      expect(book).toHaveProperty('low_stock');
      expect(typeof book.low_stock).toBe('boolean');
    });
  });

  it('low_stock=true quando quantity <= 5', async () => {
    const res = await request(app)
      .get('/api/v1/books')
      .set(auth);

    const dune       = res.body.data.find(b => b.title === 'Dune');
    const foundation = res.body.data.find(b => b.title === 'Foundation');
    const outOfPrint = res.body.data.find(b => b.title === 'Out of Print');

    expect(dune.low_stock).toBe(false);       // quantity=10
    expect(foundation.low_stock).toBe(true);  // quantity=3
    expect(outOfPrint.low_stock).toBe(true);  // quantity=0
  });

  // -------------------------------------------------------------------------
  // Filtri
  // -------------------------------------------------------------------------

  it('filtro ?title= parziale case-insensitive', async () => {
    const res = await request(app)
      .get('/api/v1/books?title=dune')
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].title).toBe('Dune');
  });

  it('filtro ?title= uppercase', async () => {
    const res = await request(app)
      .get('/api/v1/books?title=FOUNDATION')
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
  });

  it('filtro ?author_id= restituisce solo libri di quell autore', async () => {
    const res = await request(app)
      .get(`/api/v1/books?author_id=${authorId}`)
      .set(auth);

    expect(res.status).toBe(200);
    // bookId1 e bookId2 hanno authorId
    expect(res.body.meta.total).toBe(2);
  });

  it('filtro ?genre_id= restituisce solo libri con quel genere', async () => {
    const res = await request(app)
      .get(`/api/v1/books?genre_id=${genreId}`)
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].title).toBe('Dune');
  });

  it('filtro ?available=true restituisce solo libri con quantity > 0', async () => {
    const res = await request(app)
      .get('/api/v1/books?available=true')
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(2);
    res.body.data.forEach(b => expect(b.quantity).toBeGreaterThan(0));
  });

  it('filtro ?available=false restituisce solo libri con quantity = 0', async () => {
    const res = await request(app)
      .get('/api/v1/books?available=false')
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0].quantity).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Paginazione
  // -------------------------------------------------------------------------

  it('paginazione page=1&limit=2 → 2 risultati, total=3', async () => {
    const res = await request(app)
      .get('/api/v1/books?page=1&limit=2')
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 2, total: 3 });
  });

  it('paginazione page=2&limit=2 → 1 risultato', async () => {
    const res = await request(app)
      .get('/api/v1/books?page=2&limit=2')
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ page: 2, limit: 2, total: 3 });
  });

  // -------------------------------------------------------------------------
  // Validazione parametri errati → 400
  // -------------------------------------------------------------------------

  it('?limit=200 → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .get('/api/v1/books?limit=200')
      .set(auth);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('?page=abc → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .get('/api/v1/books?page=abc')
      .set(auth);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('?sort=isbn → 400 VALIDATION_ERROR (sort non valido)', async () => {
    const res = await request(app)
      .get('/api/v1/books?sort=isbn')
      .set(auth);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // -------------------------------------------------------------------------
  // Lista vuota
  // -------------------------------------------------------------------------

  it('lista vuota con titolo non corrispondente → data=[] total=0', async () => {
    const res = await request(app)
      .get('/api/v1/books?title=zzznomatch')
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });
});
