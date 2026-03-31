'use strict';

const { Router } = require('express');
const genresController = require('../controllers/genres');

const router = Router();

router.get('/',    genresController.list);
router.get('/:id', genresController.getById);

// Tutte le scritture sono vietate — 405 Method Not Allowed
router.all('/{*path}', (req, res, next) => {
  next({ code: 'METHOD_NOT_ALLOWED', status: 405, message: 'Genres are read-only' });
});

module.exports = router;
