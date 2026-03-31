'use strict';

const Joi = require('joi');

/**
 * Schema per validare un ID numerico da URL param.
 * Esempio: req.params.id
 */
const idSchema = Joi.object({
  id: Joi.number().integer().positive().required()
});

/**
 * Schema per parametri di paginazione comuni.
 * Usato in GET /authors, /publishers.
 */
const paginationSchema = Joi.object({
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

/**
 * Valida req.params.id e lancia un errore applicativo se non valido.
 * @param {string|number} id
 * @returns {number} - id come intero
 */
function validateId(id) {
  const { error, value } = idSchema.validate({ id });
  if (error) {
    throw {
      code: 'VALIDATION_ERROR',
      status: 400,
      message: 'Invalid ID parameter',
      details: [{ field: 'id', message: error.message }]
    };
  }
  return value.id;
}

/**
 * Valida e applica i default ai parametri di paginazione.
 * @param {object} query
 * @returns {{ page: number, limit: number }}
 */
function validatePagination(query) {
  const { error, value } = paginationSchema.validate(query, { allowUnknown: true });
  if (error) {
    throw {
      code: 'VALIDATION_ERROR',
      status: 400,
      message: 'Invalid pagination parameters',
      details: error.details.map(d => ({ field: d.path.join('.'), message: d.message }))
    };
  }
  return value;
}

module.exports = { validateId, validatePagination };
