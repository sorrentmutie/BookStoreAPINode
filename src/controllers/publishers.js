'use strict';

const publishersRepository = require('../repositories/publishers');
const { validateCreatePublisher, validateUpdatePublisher } = require('../validators/publishers');
const { validateId, validatePagination } = require('../validators/common');

function create(req, res, next) {
  // TODO: validate → repository.create → res.status(201).json({ data })
}

function list(req, res, next) {
  // TODO: validate query → repository.list → res.json({ data, meta })
}

function getById(req, res, next) {
  // TODO: validate id → repository.findById → res.json({ data })
}

function update(req, res, next) {
  // TODO: validate id + body → repository.update → res.json({ data })
}

function remove(req, res, next) {
  // TODO: validate id → repository.remove (409 se ha dipendenze) → res.status(204).send()
}

module.exports = { create, list, getById, update, remove };
