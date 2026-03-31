'use strict';

const db = require('../database');

/**
 * @param {object} data - { name }
 * @returns {object} - editore creato
 */
function create(data) {
  // TODO
}

/**
 * @param {{ page: number, limit: number }} pagination
 * @returns {{ rows: object[], total: number }}
 */
function list({ page, limit }) {
  // TODO
}

/**
 * @param {number} id
 * @returns {object|null}
 */
function findById(id) {
  // TODO
}

/**
 * @param {number} id
 * @param {object} data - { name }
 * @returns {object|null}
 */
function update(id, data) {
  // TODO
}

/**
 * Elimina l'editore. Lancia un errore applicativo se ha libri associati.
 * @param {number} id
 * @returns {boolean}
 */
function remove(id) {
  // TODO: verificare books.publisher_id prima di eliminare
}

module.exports = { create, list, findById, update, remove };
