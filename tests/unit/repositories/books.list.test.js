'use strict';

// DB_PATH deve essere ':memory:' prima che database.js venga caricato.
// Poiché Jest esegue ogni file in un worker separato, questa assegnazione
// avviene prima di qualsiasi require.
process.env.DB_PATH = ':memory:';

const db = require('../../../src/database');
const booksRepo = require('../../../src/repositories/books');

// ---------------------------------------------------------------------------
// Helpers per inserire fixture direttamente via SQL
// ---------------------------------------------------------------------------

function insertPublisher(name = 'Test Publisher') {
  return db
    .prepare('INSERT INTO publishers (name) VALUES (?)')
    .run(name).lastInsertRowid;
}

function insertAuthor(firstName = 'John', lastName = 'Doe') {
  return db
    .prepare('INSERT INTO authors (first_name, last_name) VALUES (?, ?)')
    .run(firstName, lastName).lastInsertRowid;
}

function getGenreId(name) {
  return db.prepare('SELECT id FROM genres WHERE name = ?').get(name).id;
}

function insertBook({ title, isbn, price = 10, quantity = 5, publication_year = 2020, publisher_id, description = null }) {
  return db.prepare(`
    INSERT INTO books (title, isbn, price, quantity, publication_year, publisher_id, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(title, isbn, price, quantity, publication_year, publisher_id, description).lastInsertRowid;
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

describe('booksRepository.list', () => {
  let pubId;
  let authorId;
  let genreId;

  beforeAll(() => {
    pubId    = insertPublisher('Publisher A');
    authorId = insertAuthor('Alice', 'Smith');
    genreId  = getGenreId('Fiction');
  });

  afterAll(() => {
    // Pulizia completa per isolare la suite
    db.prepare('DELETE FROM books').run();
    db.prepare('DELETE FROM publishers WHERE id = ?').run(pubId);
    db.prepare('DELETE FROM authors WHERE id = ?').run(authorId);
  });

  describe('lista vuota', () => {
    it('ritorna { rows: [], total: 0 } quando non ci sono libri', () => {
      const result = booksRepo.list({ page: 1, limit: 20 });
      expect(result).toEqual({ rows: [], total: 0 });
    });
  });

  describe('con libri inseriti', () => {
    let bookId1;
    let bookId2;
    let bookId3;

    beforeAll(() => {
      // Libro 1: quantity > 0, titolo "The Great Adventure"
      bookId1 = insertBook({ title: 'The Great Adventure', isbn: '0306406152', price: 15, quantity: 10, publication_year: 2020, publisher_id: pubId });
      linkAuthor(bookId1, authorId);
      linkGenre(bookId1, genreId);

      // Libro 2: quantity > 0, titolo "Science of Everything"
      bookId2 = insertBook({ title: 'Science of Everything', isbn: '0306406160', price: 25, quantity: 3, publication_year: 2021, publisher_id: pubId });
      linkAuthor(bookId2, authorId);
      // No genre link per bookId2

      // Libro 3: quantity = 0 (non disponibile)
      bookId3 = insertBook({ title: 'Out of Print', isbn: '0306406179', price: 5, quantity: 0, publication_year: 2019, publisher_id: pubId });
    });

    it('ritorna tutti i libri con page e limit defaults', () => {
      const result = booksRepo.list({ page: 1, limit: 20 });
      expect(result.total).toBe(3);
      expect(result.rows).toHaveLength(3);
    });

    it('ogni row ha i campi base del libro', () => {
      const result = booksRepo.list({ page: 1, limit: 20 });
      const row = result.rows[0];
      expect(row).toHaveProperty('id');
      expect(row).toHaveProperty('title');
      expect(row).toHaveProperty('isbn');
      expect(row).toHaveProperty('price');
      expect(row).toHaveProperty('quantity');
      expect(row).toHaveProperty('publisher_id');
    });

    describe('filtro title (contains, case-insensitive)', () => {
      it('filtra per titolo parziale lowercase', () => {
        const result = booksRepo.list({ page: 1, limit: 20, title: 'great' });
        expect(result.total).toBe(1);
        expect(result.rows[0].title).toBe('The Great Adventure');
      });

      it('filtra per titolo parziale uppercase', () => {
        const result = booksRepo.list({ page: 1, limit: 20, title: 'SCIENCE' });
        expect(result.total).toBe(1);
        expect(result.rows[0].title).toBe('Science of Everything');
      });

      it('ritorna 0 risultati se titolo non corrisponde', () => {
        const result = booksRepo.list({ page: 1, limit: 20, title: 'zzznomatch' });
        expect(result.total).toBe(0);
        expect(result.rows).toHaveLength(0);
      });
    });

    describe('filtro author_id', () => {
      it('filtra per author_id restituendo solo libri di quell autore', () => {
        const result = booksRepo.list({ page: 1, limit: 20, author_id: authorId });
        // bookId1 e bookId2 hanno authorId, bookId3 no
        expect(result.total).toBe(2);
      });

      it('ritorna 0 risultati per author_id inesistente', () => {
        const result = booksRepo.list({ page: 1, limit: 20, author_id: 99999 });
        expect(result.total).toBe(0);
      });
    });

    describe('filtro genre_id', () => {
      it('filtra per genre_id restituendo solo libri con quel genere', () => {
        const result = booksRepo.list({ page: 1, limit: 20, genre_id: genreId });
        // Solo bookId1 ha genreId
        expect(result.total).toBe(1);
        expect(result.rows[0].id).toBe(bookId1);
      });

      it('ritorna 0 risultati per genre_id inesistente', () => {
        const result = booksRepo.list({ page: 1, limit: 20, genre_id: 99999 });
        expect(result.total).toBe(0);
      });
    });

    describe('filtro available', () => {
      it('available=true restituisce solo libri con quantity > 0', () => {
        const result = booksRepo.list({ page: 1, limit: 20, available: true });
        expect(result.total).toBe(2);
        result.rows.forEach(r => expect(r.quantity).toBeGreaterThan(0));
      });

      it('available=false restituisce solo libri con quantity = 0', () => {
        const result = booksRepo.list({ page: 1, limit: 20, available: false });
        expect(result.total).toBe(1);
        expect(result.rows[0].quantity).toBe(0);
      });
    });

    describe('paginazione', () => {
      it('page=1 limit=2 ritorna i primi 2 libri e total=3', () => {
        const result = booksRepo.list({ page: 1, limit: 2 });
        expect(result.total).toBe(3);
        expect(result.rows).toHaveLength(2);
      });

      it('page=2 limit=2 ritorna il libro rimanente', () => {
        const result = booksRepo.list({ page: 2, limit: 2 });
        expect(result.total).toBe(3);
        expect(result.rows).toHaveLength(1);
      });

      it('page=3 limit=2 ritorna array vuoto', () => {
        const result = booksRepo.list({ page: 3, limit: 2 });
        expect(result.total).toBe(3);
        expect(result.rows).toHaveLength(0);
      });
    });
  });
});
