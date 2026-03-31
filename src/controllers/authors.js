'use strict';

const authorsRepository = require('../repositories/authors');
const { validateCreateAuthor, validateUpdateAuthor } = require('../validators/authors');
const { validateId, validatePagination } = require('../validators/common');

/**
 * POST /api/v1/authors
 * Crea un nuovo autore. Risponde 201 con `{ data: author }`.
 * @type {import('express').RequestHandler}
 */
function create(req, res, next) {
  let data;
  try {
    data = validateCreateAuthor(req.body);
  } catch (e) {
    return next(e);
  }

  let author;
  try {
    author = authorsRepository.create(data);
  } catch (e) {
    return next(e);
  }

  res.status(201).json({ data: author });
}

/**
 * GET /api/v1/authors
 * Lista paginata. Accetta query params: page, limit, search.
 * Risponde 200 con `{ data: authors[], meta: { page, limit, total } }`.
 * @type {import('express').RequestHandler}
 */
function list(req, res, next) {
  let pagination;
  try {
    pagination = validatePagination(req.query);
  } catch (e) {
    return next(e);
  }

  const { page, limit } = pagination;
  const search = req.query.search || undefined;

  let result;
  try {
    result = authorsRepository.list({ page, limit, search });
  } catch (e) {
    return next(e);
  }

  res.json({
    data: result.rows,
    meta: { page, limit, total: result.total },
  });
}

/**
 * GET /api/v1/authors/:id
 * Dettaglio autore con lista libri associati. 404 se non trovato.
 * @type {import('express').RequestHandler}
 */
function getById(req, res, next) {
  let id;
  try {
    id = validateId(req.params.id);
  } catch (e) {
    return next(e);
  }

  let author;
  try {
    author = authorsRepository.findById(id);
  } catch (e) {
    return next(e);
  }

  if (!author) {
    return next({ code: 'AUTHOR_NOT_FOUND', status: 404, message: 'Author not found' });
  }

  res.json({ data: author });
}

/**
 * PATCH /api/v1/authors/:id
 * Aggiornamento parziale. 404 se non trovato, 400 se dati non validi.
 * @type {import('express').RequestHandler}
 */
function update(req, res, next) {
  let id;
  try {
    id = validateId(req.params.id);
  } catch (e) {
    return next(e);
  }

  let data;
  try {
    data = validateUpdateAuthor(req.body);
  } catch (e) {
    return next(e);
  }

  let author;
  try {
    author = authorsRepository.update(id, data);
  } catch (e) {
    return next(e);
  }

  if (!author) {
    return next({ code: 'AUTHOR_NOT_FOUND', status: 404, message: 'Author not found' });
  }

  res.json({ data: author });
}

/**
 * DELETE /api/v1/authors/:id
 * Elimina l'autore. 204 in caso di successo.
 * 404 se non trovato, 409 AUTHOR_HAS_BOOKS se ha libri associati.
 * @type {import('express').RequestHandler}
 */
function remove(req, res, next) {
  let id;
  try {
    id = validateId(req.params.id);
  } catch (e) {
    return next(e);
  }

  let result;
  try {
    result = authorsRepository.remove(id);
  } catch (e) {
    return next(e);
  }

  if (!result) {
    return next({ code: 'AUTHOR_NOT_FOUND', status: 404, message: 'Author not found' });
  }

  if (result.conflict) {
    return next({ code: 'AUTHOR_HAS_BOOKS', status: 409, message: 'Cannot delete author with associated books' });
  }

  res.status(204).send();
}

module.exports = { create, list, getById, update, remove };
