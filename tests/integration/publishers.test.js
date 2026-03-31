'use strict';

const request = require('supertest');
const app = require('../../src/app');

const API_KEY = process.env.TEST_API_KEY || 'dev-key-1234';

describe('POST /api/v1/publishers', () => {
  test.todo('crea editore → 201');
  test.todo('name mancante → 400 VALIDATION_ERROR');
});

describe('GET /api/v1/publishers', () => {
  test.todo('lista paginata');
});

describe('GET /api/v1/publishers/:id', () => {
  test.todo('dettaglio editore');
  test.todo('id inesistente → 404');
});

describe('PATCH /api/v1/publishers/:id', () => {
  test.todo('aggiornamento name');
  test.todo('id inesistente → 404');
});

describe('DELETE /api/v1/publishers/:id', () => {
  test.todo('editore senza libri → 204');
  test.todo('editore con libri → 409 HAS_DEPENDENCIES');
  test.todo('id inesistente → 404');
});
