'use strict';

const genresRepository = require('../repositories/genres');

function list(req, res, next) {
  // TODO: repository.listAll → res.json({ data })
}

function getById(req, res, next) {
  // TODO: validate id → repository.findById → res.json({ data })
}

module.exports = { list, getById };
