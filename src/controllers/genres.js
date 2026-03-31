'use strict';

const genresRepository = require('../repositories/genres');
const { validateId } = require('../validators/common');

/**
 * GET /api/v1/genres
 * Restituisce tutti i generi pre-seeded (lista non paginata).
 * @type {import('express').RequestHandler}
 */
function list(req, res, next) {
  let genres;
  try {
    genres = genresRepository.listAll();
  } catch (e) {
    return next(e);
  }

  res.json({ data: genres });
}

/**
 * GET /api/v1/genres/:id
 * Dettaglio genere con `book_count`. 404 GENRE_NOT_FOUND se non trovato.
 * @type {import('express').RequestHandler}
 */
function getById(req, res, next) {
  let id;
  try {
    id = validateId(req.params.id);
  } catch (e) {
    return next(e);
  }

  let genre;
  try {
    genre = genresRepository.findById(id);
  } catch (e) {
    return next(e);
  }

  if (!genre) {
    return next({ code: 'GENRE_NOT_FOUND', status: 404, message: 'Genre not found' });
  }

  res.json({ data: genre });
}

module.exports = { list, getById };
