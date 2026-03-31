'use strict';

const db = require('../database');

/**
 * Colonne ammesse per il parametro sort — whitelist per evitare SQL injection.
 */
const SORT_COLUMNS = {
  title:            'b.title',
  price:            'b.price',
  publication_year: 'b.publication_year',
};

// ---------------------------------------------------------------------------
// findById — eager loading completo
// ---------------------------------------------------------------------------

/**
 * Restituisce il dettaglio completo di un libro con eager loading.
 * @param {number} id
 * @returns {object|null}
 */
function findById(id) {
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(id);
  if (!book) return null;

  // Publisher (può essere null per libri creati col modello semplificato)
  const publisher = book.publisher_id != null
    ? db.prepare('SELECT * FROM publishers WHERE id = ?').get(book.publisher_id)
    : null;

  // Authors
  const authors = db.prepare(`
    SELECT a.*
    FROM authors a
    INNER JOIN book_authors ba ON ba.author_id = a.id
    WHERE ba.book_id = ?
    ORDER BY a.last_name, a.first_name
  `).all(id);

  // Genres
  const genres = db.prepare(`
    SELECT g.*
    FROM genres g
    INNER JOIN book_genres bg ON bg.genre_id = g.id
    WHERE bg.book_id = ?
    ORDER BY g.name
  `).all(id);

  return { ...book, publisher, authors, genres };
}

// ---------------------------------------------------------------------------
// list — query dinamica con filtri e paginazione
// ---------------------------------------------------------------------------

/**
 * Restituisce la lista paginata di libri con filtri opzionali.
 * @param {object} filters - { title, author_id, genre_id, publisher_id, available, page, limit, sort, order }
 * @returns {{ rows: object[], total: number }}
 */
function list(filters = {}) {
  const {
    title,
    author_id,
    genre_id,
    publisher_id,
    available,
    page  = 1,
    limit = 20,
    sort  = 'title',
    order = 'asc',
  } = filters;

  const params      = [];
  const countParams = [];
  const joins       = [];
  const conditions  = [];

  // JOIN condizionali
  if (author_id !== undefined) {
    joins.push('INNER JOIN book_authors ba ON ba.book_id = b.id');
    conditions.push('ba.author_id = ?');
    params.push(author_id);
    countParams.push(author_id);
  }

  if (genre_id !== undefined) {
    joins.push('INNER JOIN book_genres bg ON bg.book_id = b.id');
    conditions.push('bg.genre_id = ?');
    params.push(genre_id);
    countParams.push(genre_id);
  }

  // WHERE semplici
  if (title !== undefined) {
    conditions.push("b.title LIKE ? ESCAPE '\\'");
    const pattern = `%${title.replace(/[%_\\]/g, '\\$&')}%`;
    params.push(pattern);
    countParams.push(pattern);
  }

  if (publisher_id !== undefined) {
    conditions.push('b.publisher_id = ?');
    params.push(publisher_id);
    countParams.push(publisher_id);
  }

  if (available === true) {
    conditions.push('b.quantity > 0');
  } else if (available === false) {
    conditions.push('b.quantity = 0');
  }

  const whereClause = conditions.length > 0
    ? 'WHERE ' + conditions.join(' AND ')
    : '';

  const joinClause = joins.join(' ');

  // Whitelist sort column
  const sortCol  = SORT_COLUMNS[sort] || 'b.title';
  const orderDir = order === 'desc' ? 'DESC' : 'ASC';

  // COUNT query
  const countSql = `
    SELECT COUNT(DISTINCT b.id) AS total
    FROM books b
    ${joinClause}
    ${whereClause}
  `;
  const { total } = db.prepare(countSql).get(...countParams);

  // Data query con DISTINCT per evitare duplicati da JOIN
  const offset = (page - 1) * limit;
  const dataSql = `
    SELECT DISTINCT b.*
    FROM books b
    ${joinClause}
    ${whereClause}
    ORDER BY ${sortCol} ${orderDir}
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);

  const rows = db.prepare(dataSql).all(...params);

  return { rows, total };
}

// ---------------------------------------------------------------------------
// create — transazione
// ---------------------------------------------------------------------------

/**
 * Crea un nuovo libro (modello semplificato).
 * @param {object} data - { title, isbn, author, price, category }
 * @returns {object} - libro creato
 */
function create(data) {
  const { title, isbn, author, price, category } = data;

  let newId;
  try {
    const result = db.prepare(`
      INSERT INTO books (title, isbn, author, price, category)
      VALUES (?, ?, ?, ?, ?)
    `).run(title, isbn, author, price, category);
    newId = result.lastInsertRowid;
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw { code: 'DUPLICATE_ISBN', status: 409, message: 'A book with this ISBN already exists' };
    }
    throw err;
  }

  return findById(newId);
}

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

/**
 * Aggiornamento parziale. Aggiorna solo i campi presenti in data.
 * Se author_ids o genre_ids sono presenti, sostituisce le associazioni.
 * @param {number} id
 * @param {object} data
 * @returns {object|null} - libro aggiornato o null se non trovato
 */
function update(id, data) {
  const SCALAR_FIELDS = ['title', 'isbn', 'price', 'quantity', 'publication_year', 'description', 'publisher_id'];

  const doUpdate = db.transaction(() => {
    // Verifica esistenza
    const existing = db.prepare('SELECT id FROM books WHERE id = ?').get(id);
    if (!existing) return null;

    const { author_ids, genre_ids, ...scalars } = data;

    // Verifica FK se presenti
    if (scalars.publisher_id !== undefined) {
      const pub = db.prepare('SELECT id FROM publishers WHERE id = ?').get(scalars.publisher_id);
      if (!pub) {
        throw { code: 'VALIDATION_ERROR', status: 400, message: 'Validation failed', details: [{ field: 'publisher_id', message: 'Publisher not found' }] };
      }
    }

    if (author_ids && author_ids.length > 0) {
      const placeholders = author_ids.map(() => '?').join(', ');
      const found = db.prepare(`SELECT id FROM authors WHERE id IN (${placeholders})`).all(...author_ids);
      if (found.length !== author_ids.length) {
        throw { code: 'VALIDATION_ERROR', status: 400, message: 'Validation failed', details: [{ field: 'author_ids', message: 'One or more authors not found' }] };
      }
    }

    if (genre_ids && genre_ids.length > 0) {
      const placeholders = genre_ids.map(() => '?').join(', ');
      const found = db.prepare(`SELECT id FROM genres WHERE id IN (${placeholders})`).all(...genre_ids);
      if (found.length !== genre_ids.length) {
        throw { code: 'VALIDATION_ERROR', status: 400, message: 'Validation failed', details: [{ field: 'genre_ids', message: 'One or more genres not found' }] };
      }
    }

    // UPDATE scalari solo se presenti
    const fields = SCALAR_FIELDS.filter(f => scalars[f] !== undefined);
    if (fields.length > 0) {
      const setClauses = fields.map(f => `${f} = ?`);
      setClauses.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
      const values = fields.map(f => scalars[f]);
      values.push(id);

      try {
        db.prepare(`UPDATE books SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
      } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw { code: 'DUPLICATE_ISBN', status: 409, message: 'A book with this ISBN already exists' };
        }
        throw err;
      }
    }

    // Sostituisci autori
    if (author_ids !== undefined) {
      db.prepare('DELETE FROM book_authors WHERE book_id = ?').run(id);
      const insertAuthor = db.prepare('INSERT INTO book_authors (book_id, author_id) VALUES (?, ?)');
      for (const aid of author_ids) {
        insertAuthor.run(id, aid);
      }
    }

    // Sostituisci generi
    if (genre_ids !== undefined) {
      db.prepare('DELETE FROM book_genres WHERE book_id = ?').run(id);
      const insertGenre = db.prepare('INSERT INTO book_genres (book_id, genre_id) VALUES (?, ?)');
      for (const gid of genre_ids) {
        insertGenre.run(id, gid);
      }
    }

    return findById(id);
  });

  return doUpdate();
}

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

/**
 * Hard delete del libro. Le relazioni book_authors e book_genres vengono
 * eliminate automaticamente via ON DELETE CASCADE.
 * @param {number} id
 * @returns {boolean} - false se il libro non esisteva
 */
function remove(id) {
  const result = db.prepare('DELETE FROM books WHERE id = ?').run(id);
  return result.changes > 0;
}

module.exports = { create, list, findById, update, remove };
