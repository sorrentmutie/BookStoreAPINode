'use strict';

const publishersRepository = require('../repositories/publishers');
const { validateCreatePublisher, validateUpdatePublisher } = require('../validators/publishers');
const { validateId, validatePagination } = require('../validators/common');

/**
 * POST /api/v1/publishers
 * Crea un nuovo editore. 201 in caso di successo, 409 DUPLICATE_NAME se il nome esiste già.
 * @type {import('express').RequestHandler}
 */
function create(req, res, next) {
  let data;
  try {
    data = validateCreatePublisher(req.body);
  } catch (e) {
    return next(e);
  }

  let publisher;
  try {
    publisher = publishersRepository.create(data);
  } catch (e) {
    return next(e);
  }

  res.status(201).json({ data: publisher });
}

/**
 * GET /api/v1/publishers
 * Lista paginata. Accetta query params: page, limit, search.
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
    result = publishersRepository.list({ page, limit, search });
  } catch (e) {
    return next(e);
  }

  res.json({
    data: result.rows,
    meta: { page, limit, total: result.total },
  });
}

/**
 * GET /api/v1/publishers/:id
 * Dettaglio editore con `book_count`. 404 se non trovato.
 * @type {import('express').RequestHandler}
 */
function getById(req, res, next) {
  let id;
  try {
    id = validateId(req.params.id);
  } catch (e) {
    return next(e);
  }

  let publisher;
  try {
    publisher = publishersRepository.findById(id);
  } catch (e) {
    return next(e);
  }

  if (!publisher) {
    return next({ code: 'PUBLISHER_NOT_FOUND', status: 404, message: 'Publisher not found' });
  }

  res.json({ data: publisher });
}

/**
 * PATCH /api/v1/publishers/:id
 * Aggiornamento parziale. 404 se non trovato, 409 DUPLICATE_NAME se il nuovo nome esiste già.
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
    data = validateUpdatePublisher(req.body);
  } catch (e) {
    return next(e);
  }

  let publisher;
  try {
    publisher = publishersRepository.update(id, data);
  } catch (e) {
    return next(e);
  }

  if (!publisher) {
    return next({ code: 'PUBLISHER_NOT_FOUND', status: 404, message: 'Publisher not found' });
  }

  res.json({ data: publisher });
}

/**
 * DELETE /api/v1/publishers/:id
 * Elimina l'editore. 204 in caso di successo.
 * 404 se non trovato, 409 PUBLISHER_HAS_BOOKS se ha libri associati.
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
    result = publishersRepository.remove(id);
  } catch (e) {
    return next(e);
  }

  if (!result) {
    return next({ code: 'PUBLISHER_NOT_FOUND', status: 404, message: 'Publisher not found' });
  }

  if (result.conflict) {
    return next({ code: 'PUBLISHER_HAS_BOOKS', status: 409, message: 'Cannot delete publisher with associated books' });
  }

  res.status(204).send();
}

module.exports = { create, list, getById, update, remove };
