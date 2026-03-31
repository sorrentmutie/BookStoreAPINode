'use strict';

const Joi = require('joi');

const createAuthorSchema = Joi.object({
  first_name:  Joi.string().min(1).required(),
  last_name:   Joi.string().min(1).required(),
  birth_date:  Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null, '').optional(),
  biography:   Joi.string().allow(null, '').optional(),
  nationality: Joi.string().allow(null, '').optional()
});

const updateAuthorSchema = Joi.object({
  first_name:  Joi.string().min(1),
  last_name:   Joi.string().min(1),
  birth_date:  Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null, ''),
  biography:   Joi.string().allow(null, ''),
  nationality: Joi.string().allow(null, '')
}).options({ stripUnknown: true });

function validateCreateAuthor(body) {
  const { error, value } = createAuthorSchema.validate(body, { abortEarly: false });
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

function validateUpdateAuthor(body) {
  const { error, value } = updateAuthorSchema.validate(body, { abortEarly: false });
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

module.exports = { validateCreateAuthor, validateUpdateAuthor };
