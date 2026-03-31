'use strict';

const db = require('../database');

/**
 * Cerca una API key nel database.
 * @param {string} key - valore dell'header X-API-Key
 * @returns {{ id: number, key: string, client_name: string }|null}
 */
function findByKey(key) {
  // TODO
}

module.exports = { findByKey };
