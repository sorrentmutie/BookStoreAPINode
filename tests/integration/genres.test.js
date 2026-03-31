'use strict';

const request = require('supertest');
const app = require('../../src/app');

const API_KEY = process.env.TEST_API_KEY || 'dev-key-1234';
const headers = { 'X-API-Key': API_KEY };

describe('GET /api/v1/genres', () => {
  test.todo('lista completa non paginata con 11 generi');
});

describe('GET /api/v1/genres/:id', () => {
  test.todo('dettaglio genere esistente');
  test.todo('id inesistente → 404');
});

describe('Genres sola lettura', () => {
  test.todo('POST /api/v1/genres → 405 METHOD_NOT_ALLOWED');
  test.todo('PATCH /api/v1/genres/1 → 405 METHOD_NOT_ALLOWED');
  test.todo('DELETE /api/v1/genres/1 → 405 METHOD_NOT_ALLOWED');
});

describe('Autenticazione', () => {
  test.todo('richiesta senza X-API-Key → 401 MISSING_API_KEY');
  test.todo('richiesta con API Key non valida → 401 INVALID_API_KEY');
});
