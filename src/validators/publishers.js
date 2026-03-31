'use strict';

const Joi = require('joi');

const createPublisherSchema = Joi.object({
  name: Joi.string().min(1).required()
});

const updatePublisherSchema = Joi.object({
  name: Joi.string().min(1).required()
}).options({ stripUnknown: true });

function validateCreatePublisher(body) {
  const { error, value } = createPublisherSchema.validate(body, { abortEarly: false });
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

function validateUpdatePublisher(body) {
  const { error, value } = updatePublisherSchema.validate(body, { abortEarly: false });
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

module.exports = { validateCreatePublisher, validateUpdatePublisher };
