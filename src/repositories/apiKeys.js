'use strict';

const db = require('../database');

/**
 * Cerca una API key nel database.
 * @param {string} key - valore dell'header X-API-Key
 * @returns {{ id: number, key: string, client_name: string }|null}
 */
function findByKey(key) {
  return db.prepare('SELECT * FROM api_keys WHERE key = ?').get(key) ?? null;
}

module.exports = { findByKey };
