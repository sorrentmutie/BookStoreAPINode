'use strict';

const db = require('../database');

/**
 * Crea un nuovo libro con le sue relazioni autori/generi in una transazione.
 * @param {object} data - { title, isbn, price, quantity, publication_year, description, publisher_id, author_ids, genre_ids }
 * @returns {object} - libro creato con eager loading
 */
function create(data) {
  // TODO
}

/**
 * Restituisce la lista paginata di libri con filtri e ordinamento.
 * Autori e generi sono restituiti come array di ID (no eager loading).
 * @param {object} filters - { title, author_id, genre_id, publisher_id, page, limit, sort, order }
 * @returns {{ rows: object[], total: number }}
 */
function list(filters) {
  // TODO
}

/**
 * Restituisce il dettaglio completo di un libro con eager loading.
 * @param {number} id
 * @returns {object|null}
 */
function findById(id) {
  // TODO
}

/**
 * Aggiornamento parziale. Aggiorna solo i campi presenti in data.
 * Se author_ids o genre_ids sono presenti, sostituisce le associazioni.
 * @param {number} id
 * @param {object} data
 * @returns {object|null} - libro aggiornato o null se non trovato
 */
function update(id, data) {
  // TODO
}

/**
 * Hard delete del libro. Le relazioni book_authors e book_genres vengono
 * eliminate automaticamente via ON DELETE CASCADE.
 * @param {number} id
 * @returns {boolean} - false se il libro non esisteva
 */
function remove(id) {
  // TODO
}

module.exports = { create, list, findById, update, remove };
