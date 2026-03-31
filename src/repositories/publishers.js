'use strict';

const db = require('../database');

/**
 * Restituisce un editore con il numero di libri associati.
 * @param {number} id
 * @returns {object|null} Editore con campo `book_count`, o null se non trovato.
 */
function findById(id) {
  const publisher = db.prepare('SELECT * FROM publishers WHERE id = ?').get(id);
  if (!publisher) return null;

  const { book_count } = db.prepare(
    'SELECT COUNT(*) AS book_count FROM books WHERE publisher_id = ?'
  ).get(id);

  return { ...publisher, book_count };
}

/**
 * Lista paginata di editori con ricerca opzionale sul nome.
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
    conditions.push("name LIKE ? ESCAPE '\\'");
    const pattern = `%${search.replace(/[%_\\]/g, '\\$&')}%`;
    params.push(pattern);
    countParams.push(pattern);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM publishers ${whereClause}`).get(...countParams);

  const offset = (page - 1) * limit;
  const rows = db.prepare(`
    SELECT * FROM publishers ${whereClause}
    ORDER BY name
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return { rows, total };
}

/**
 * Inserisce un nuovo editore.
 * @param {object} data
 * @param {string} data.name
 * @returns {object} Editore creato con `book_count: 0`.
 * @throws {{ code: 'DUPLICATE_NAME', status: 409 }} Se il nome è già presente.
 */
function create(data) {
  const { name } = data;

  const existing = db.prepare('SELECT id FROM publishers WHERE name = ?').get(name);
  if (existing) {
    throw { code: 'DUPLICATE_NAME', status: 409, message: 'A publisher with this name already exists' };
  }

  const result = db.prepare('INSERT INTO publishers (name) VALUES (?)').run(name);
  return findById(result.lastInsertRowid);
}

/**
 * Aggiornamento parziale di un editore.
 * @param {number} id
 * @param {object} data
 * @param {string} [data.name]
 * @returns {object|null} Editore aggiornato, o null se non trovato.
 * @throws {{ code: 'DUPLICATE_NAME', status: 409 }} Se il nome è già usato da un altro editore.
 */
function update(id, data) {
  const existing = db.prepare('SELECT id FROM publishers WHERE id = ?').get(id);
  if (!existing) return null;

  if (data.name !== undefined) {
    const duplicate = db.prepare('SELECT id FROM publishers WHERE name = ? AND id != ?').get(data.name, id);
    if (duplicate) {
      throw { code: 'DUPLICATE_NAME', status: 409, message: 'A publisher with this name already exists' };
    }

    db.prepare(`
      UPDATE publishers
      SET name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ?
    `).run(data.name, id);
  }

  return findById(id);
}

/**
 * Elimina un editore. Restituisce `{ conflict: true }` se ha libri associati.
 * @param {number} id
 * @returns {{ deleted: true }|{ conflict: true }|null} null se non trovato.
 */
function remove(id) {
  const existing = db.prepare('SELECT id FROM publishers WHERE id = ?').get(id);
  if (!existing) return null;

  const { count } = db.prepare('SELECT COUNT(*) AS count FROM books WHERE publisher_id = ?').get(id);
  if (count > 0) return { conflict: true };

  db.prepare('DELETE FROM publishers WHERE id = ?').run(id);
  return { deleted: true };
}

module.exports = { create, list, findById, update, remove };
