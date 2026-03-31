'use strict';

const booksRepository = require('../repositories/books');
const { validateCreateBook, validateUpdateBook, validateListQuery } = require('../validators/books');
const { validateId } = require('../validators/common');

function addLowStock(book) {
  return { ...book, low_stock: book.quantity <= 5 };
}

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
  // TODO: validate id → repository.remove → res.status(204).send()
}

module.exports = { create, list, getById, update, remove };
