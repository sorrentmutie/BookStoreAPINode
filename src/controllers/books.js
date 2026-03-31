'use strict';

const booksRepository = require('../repositories/books');
const { validateCreateBook, validateUpdateBook, validateListQuery } = require('../validators/books');
const { validateId } = require('../validators/common');

function addLowStock(book) {
  return { ...book, low_stock: book.quantity <= 5 };
}

function create(req, res, next) {
  let data;
  try {
    data = validateCreateBook(req.body);
  } catch (e) {
    return next(e);
  }

  let book;
  try {
    book = booksRepository.create(data);
  } catch (e) {
    return next(e);
  }

  res.status(201).location(`/api/v1/books/${book.id}`).json({ data: addLowStock(book) });
}

function list(req, res, next) {
  let filters;
  try {
    filters = validateListQuery(req.query);
  } catch (e) {
    return next(e);
  }

  let result;
  try {
    result = booksRepository.list(filters);
  } catch (e) {
    return next(e);
  }

  const books = result.rows.map(addLowStock);

  res.json({
    data: books,
    meta: {
      page:  filters.page,
      limit: filters.limit,
      total: result.total,
    },
  });
}

function getById(req, res, next) {
  let id;
  try {
    id = validateId(req.params.id);
  } catch (e) {
    return next(e);
  }

  let book;
  try {
    book = booksRepository.findById(id);
  } catch (e) {
    return next(e);
  }

  if (!book) {
    return next({ code: 'NOT_FOUND', status: 404, message: 'Book not found' });
  }

  res.json({ data: addLowStock(book) });
}

function update(req, res, next) {
  let id;
  try {
    id = validateId(req.params.id);
  } catch (e) {
    return next(e);
  }

  let data;
  try {
    data = validateUpdateBook(req.body);
  } catch (e) {
    return next(e);
  }

  let book;
  try {
    book = booksRepository.update(id, data);
  } catch (e) {
    return next(e);
  }

  if (!book) {
    return next({ code: 'NOT_FOUND', status: 404, message: 'Book not found' });
  }

  res.json({ data: addLowStock(book) });
}

function remove(req, res, next) {
  let id;
  try {
    id = validateId(req.params.id);
  } catch (e) {
    return next(e);
  }

  let found;
  try {
    found = booksRepository.remove(id);
  } catch (e) {
    return next(e);
  }

  if (!found) {
    return next({ code: 'NOT_FOUND', status: 404, message: 'Book not found' });
  }

  res.status(204).send();
}

module.exports = { create, list, getById, update, remove };
