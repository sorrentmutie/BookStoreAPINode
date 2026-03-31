'use strict';

const db = require('../database');

/**
 * Restituisce tutti i generi ordinati per nome (lista non paginata).
 * @returns {object[]} Array di generi `{ id, name }`.
 */
function listAll() {
  return db.prepare('SELECT * FROM genres ORDER BY name').all();
}

/**
 * Restituisce un genere con il numero di libri associati.
 * @param {number} id
 * @returns {object|null} Genere con campo `book_count`, o null se non trovato.
 */
function findById(id) {
  const genre = db.prepare('SELECT * FROM genres WHERE id = ?').get(id);
  if (!genre) return null;

  const { book_count } = db.prepare(
    'SELECT COUNT(*) AS book_count FROM book_genres WHERE genre_id = ?'
  ).get(id);

  return { ...genre, book_count };
}

module.exports = { listAll, findById };
