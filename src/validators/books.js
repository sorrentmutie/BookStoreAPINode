'use strict';

const Joi = require('joi');

// Categorie valide per il modello semplificato
const VALID_CATEGORIES = [
  'Fiction', 'Non-Fiction', 'Sci-Fi', 'Fantasy', 'Romance',
  'Thriller', 'Horror', 'Biography', 'History', 'Science', 'Children',
];

/**
 * Validazione ISBN-13: dopo aver rimosso i trattini deve risultare
 * esattamente 13 cifre numeriche.
 */
function isValidIsbn13(value) {
  const digits = value.replace(/-/g, '');
  return /^\d{13}$/.test(digits);
}

const createBookSchema = Joi.object({
  title:    Joi.string().max(200).required(),
  isbn:     Joi.string().custom((value, helpers) => {
    if (!isValidIsbn13(value)) return helpers.error('any.invalid');
    return value;
  }).required().messages({ 'any.invalid': 'isbn must be a valid ISBN-13 (13 digits, hyphens allowed)' }),
  author:   Joi.string().required(),
  price:    Joi.number().greater(0).required(),
  category: Joi.string().valid(...VALID_CATEGORIES).required(),
});

const updateBookSchema = Joi.object({
  title:    Joi.string().max(200),
  isbn:     Joi.string().custom((value, helpers) => {
    if (!isValidIsbn13(value)) return helpers.error('any.invalid');
    return value;
  }).messages({ 'any.invalid': 'isbn must be a valid ISBN-13 (13 digits, hyphens allowed)' }),
  author:   Joi.string(),
  price:    Joi.number().greater(0),
  category: Joi.string().valid(...VALID_CATEGORIES),
}).options({ stripUnknown: true });

const listBooksQuerySchema = Joi.object({
  title:        Joi.string(),
  author_id:    Joi.number().integer().positive(),
  genre_id:     Joi.number().integer().positive(),
  publisher_id: Joi.number().integer().positive(),
  available:    Joi.boolean(),
  page:         Joi.number().integer().min(1).default(1),
  limit:        Joi.number().integer().min(1).max(100).default(20),
  sort:         Joi.string().valid('title', 'price', 'publication_year').default('title'),
  order:        Joi.string().valid('asc', 'desc').default('asc')
});

function validateCreateBook(body) {
  const { error, value } = createBookSchema.validate(body, { abortEarly: false });
  if (error) {
    throw {
      code: 'VALIDATION_ERROR',
      status: 400,
      message: 'Validation failed',
      details: error.details.map(d => ({ field: d.path.join('.'), message: d.message }))
    };
  }
  return value;
}

function validateUpdateBook(body) {
  const { error, value } = updateBookSchema.validate(body, { abortEarly: false });
  if (error) {
    throw {
      code: 'VALIDATION_ERROR',
      status: 400,
      message: 'Validation failed',
      details: error.details.map(d => ({ field: d.path.join('.'), message: d.message }))
    };
  }
  return value;
}

function validateListQuery(query) {
  const { error, value } = listBooksQuerySchema.validate(query, { abortEarly: false });
  if (error) {
    throw {
      code: 'VALIDATION_ERROR',
      status: 400,
      message: 'Invalid query parameters',
      details: error.details.map(d => ({ field: d.path.join('.'), message: d.message }))
    };
  }
  return value;
}

module.exports = { validateCreateBook, validateUpdateBook, validateListQuery };
