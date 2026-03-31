'use strict';

const request = require('supertest');
const app = require('../../src/app');

const API_KEY = process.env.TEST_API_KEY || 'dev-key-1234';
const headers = { 'X-API-Key': API_KEY };

describe('POST /api/v1/books', () => {
  test.todo('crea un libro con payload valido → 201');
  test.todo('ISBN duplicato → 409 DUPLICATE_ISBN');
  test.todo('ISBN formato non valido → 400 VALIDATION_ERROR');
  test.todo('campi obbligatori mancanti → 400 VALIDATION_ERROR');
  test.todo('publisher_id inesistente → 400 VALIDATION_ERROR');
  test.todo('author_ids con id inesistente → 400 VALIDATION_ERROR');
  test.todo('prezzo negativo → 400 VALIDATION_ERROR');
  test.todo('quantita negativa → 400 VALIDATION_ERROR');
  test.todo('prezzo 0 → 201 (libro omaggio)');
});

describe('GET /api/v1/books', () => {
  test.todo('lista paginata con meta { page, limit, total }');
  test.todo('filtro ?title= (parziale, case-insensitive)');
  test.todo('filtro ?author_id=');
  test.todo('filtro ?genre_id=');
  test.todo('filtro ?publisher_id=');
  test.todo('default page=1 limit=20');
  test.todo('sort=price&order=asc');
  test.todo('sort non valido → 400');
  test.todo('limit > 100 → 400');
  test.todo('flag low_stock presente in ogni libro');
});

describe('GET /api/v1/books/:id', () => {
  test.todo('dettaglio con eager loading (publisher, authors, genres come oggetti)');
  test.todo('id inesistente → 404 NOT_FOUND');
  test.todo('id non numerico → 400 VALIDATION_ERROR');
});

describe('PATCH /api/v1/books/:id', () => {
  test.todo('aggiornamento parziale solo dei campi inviati');
  test.todo('quantity <= 5 → low_stock: true nella risposta');
  test.todo('quantity negativa → 400');
  test.todo('isbn duplicato → 409 DUPLICATE_ISBN');
  test.todo('author_ids sostituisce le associazioni');
  test.todo('body vuoto {} → 200 con dati invariati');
  test.todo('id inesistente → 404');
});

describe('DELETE /api/v1/books/:id', () => {
  test.todo('cancellazione → 204');
  test.todo('id inesistente → 404');
});
