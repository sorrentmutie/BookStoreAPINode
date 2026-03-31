'use strict';

const Joi = require('joi');

// Validazione ISBN-10 con check digit
// L'ultimo carattere può essere 'X' (vale 10)
function isValidIsbn10(isbn) {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(isbn[i]) * (10 - i);
  const last = isbn[9] === 'X' ? 10 : parseInt(isbn[9]);
  sum += last;
  return sum % 11 === 0;
}

const createBookSchema = Joi.object({
  title:            Joi.string().min(1).required(),
  isbn:             Joi.string().custom((value, helpers) => {
    if (!isValidIsbn10(value)) return helpers.error('any.invalid');
    return value;
  }).required().messages({ 'any.invalid': 'isbn must be a valid ISBN-10 with correct check digit' }),
  price:            Joi.number().min(0).required(),
  quantity:         Joi.number().integer().min(0).required(),
  publication_year: Joi.number().integer().required(),
  description:      Joi.string().allow('', null).optional(),
  publisher_id:     Joi.number().integer().positive().required(),
  author_ids:       Joi.array().items(Joi.number().integer().positive()).min(1).required(),
  genre_ids:        Joi.array().items(Joi.number().integer().positive()).min(1).required()
});

const updateBookSchema = Joi.object({
  title:            Joi.string().min(1),
  isbn:             Joi.string().custom((value, helpers) => {
    if (!isValidIsbn10(value)) return helpers.error('any.invalid');
    return value;
  }).messages({ 'any.invalid': 'isbn must be a valid ISBN-10 with correct check digit' }),
  price:            Joi.number().min(0),
  quantity:         Joi.number().integer().min(0),
  publication_year: Joi.number().integer(),
  description:      Joi.string().allow('', null),
  publisher_id:     Joi.number().integer().positive(),
  author_ids:       Joi.array().items(Joi.number().integer().positive()).min(1),
  genre_ids:        Joi.array().items(Joi.number().integer().positive()).min(1)
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
