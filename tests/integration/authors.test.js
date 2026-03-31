'use strict';

const request = require('supertest');
const app = require('../../src/app');

const API_KEY = process.env.TEST_API_KEY || 'dev-key-1234';

describe('POST /api/v1/authors', () => {
  test.todo('crea autore con payload valido → 201');
  test.todo('first_name mancante → 400 VALIDATION_ERROR');
  test.todo('last_name mancante → 400 VALIDATION_ERROR');
});

describe('GET /api/v1/authors', () => {
  test.todo('lista paginata con meta');
});

describe('GET /api/v1/authors/:id', () => {
  test.todo('dettaglio autore');
  test.todo('id inesistente → 404');
});

describe('PATCH /api/v1/authors/:id', () => {
  test.todo('aggiornamento parziale');
  test.todo('id inesistente → 404');
});

describe('DELETE /api/v1/authors/:id', () => {
  test.todo('autore senza libri → 204');
  test.todo('autore con libri → 409 HAS_DEPENDENCIES');
  test.todo('id inesistente → 404');
});
