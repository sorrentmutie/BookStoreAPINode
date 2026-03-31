'use strict';

const db = require('../database');

/**
 * Restituisce un autore con l'array dei libri associati.
 * @param {number} id
 * @returns {object|null} Autore con campo `books`, o null se non trovato.
 */
function findById(id) {
  const author = db.prepare('SELECT * FROM authors WHERE id = ?').get(id);
  if (!author) return null;

  const books = db.prepare(`
    SELECT b.id, b.title, b.isbn, b.price, b.category
    FROM books b
    INNER JOIN book_authors ba ON ba.book_id = b.id
    WHERE ba.author_id = ?
    ORDER BY b.title
  `).all(id);

  return { ...author, books };
}

/**
 * Lista paginata di autori con ricerca opzionale su first_name/last_name.
 * @param {object} [opts]
 * @param {number} [opts.page=1]
 * @param {number} [opts.limit=20]
 * @param {string} [opts.search] Stringa di ricerca parziale (LIKE).
 * @returns {{ rows: object[], total: number }}
 */
function list({ page = 1, limit = 20, search } = {}) {
  const params = [];
  const countParams = [];
  const conditions = [];

  if (search) {
    conditions.push("(first_name LIKE ? ESCAPE '\\' OR last_name LIKE ? ESCAPE '\\')");
    const pattern = `%${search.replace(/[%_\\]/g, '\\$&')}%`;
    params.push(pattern, pattern);
    countParams.push(pattern, pattern);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM authors ${whereClause}`).get(...countParams);

  const offset = (page - 1) * limit;
  const rows = db.prepare(`
    SELECT * FROM authors ${whereClause}
    ORDER BY last_name, first_name
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return { rows, total };
}

/**
 * Inserisce un nuovo autore e lo restituisce completo.
 * @param {object} data
 * @param {string} data.first_name
 * @param {string} data.last_name
 * @param {string|null} [data.birth_date] Formato YYYY-MM-DD.
 * @param {string|null} [data.biography]
 * @param {string|null} [data.nationality]
 * @returns {object} Autore creato con campo `books: []`.
 */
function create(data) {
  const { first_name, last_name, birth_date = null, biography = null, nationality = null } = data;

  const result = db.prepare(`
    INSERT INTO authors (first_name, last_name, birth_date, biography, nationality)
    VALUES (?, ?, ?, ?, ?)
  `).run(first_name, last_name, birth_date, biography, nationality);

  return findById(result.lastInsertRowid);
}

/**
 * Aggiornamento parziale: aggiorna solo i campi presenti in `data`.
 * @param {number} id
 * @param {object} data Campi da aggiornare (tutti opzionali).
 * @returns {object|null} Autore aggiornato, o null se non trovato.
 */
function update(id, data) {
  const FIELDS = ['first_name', 'last_name', 'birth_date', 'biography', 'nationality'];

  const existing = db.prepare('SELECT id FROM authors WHERE id = ?').get(id);
  if (!existing) return null;

  const fields = FIELDS.filter(f => data[f] !== undefined);
  if (fields.length > 0) {
    const setClauses = fields.map(f => `${f} = ?`);
    setClauses.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
    const values = fields.map(f => data[f]);
    values.push(id);
    db.prepare(`UPDATE authors SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  }

  return findById(id);
}

/**
 * Elimina un autore. Restituisce `{ conflict: true }` se ha libri associati.
 * @param {number} id
 * @returns {{ deleted: true }|{ conflict: true }|null} null se non trovato.
 */
function remove(id) {
  const existing = db.prepare('SELECT id FROM authors WHERE id = ?').get(id);
  if (!existing) return null;

  const { count } = db.prepare('SELECT COUNT(*) AS count FROM book_authors WHERE author_id = ?').get(id);
  if (count > 0) return { conflict: true };

  db.prepare('DELETE FROM authors WHERE id = ?').run(id);
  return { deleted: true };
}

module.exports = { create, list, findById, update, remove };
