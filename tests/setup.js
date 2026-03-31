'use strict';

/**
 * Jest globalSetup — eseguito una sola volta prima di tutti i test.
 *
 * Configura il DB in-memory per i test in modo che non tocchi il file .db
 * di sviluppo.
 */
async function setup() {
  process.env.NODE_ENV = 'test';
  process.env.DB_PATH  = ':memory:';
  // L'API key di test viene inserita dal seed in database.js
  process.env.TEST_API_KEY = 'dev-key-1234';
}

module.exports = setup;
