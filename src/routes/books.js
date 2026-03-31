'use strict';

const { Router } = require('express');
const booksController = require('../controllers/books');

const router = Router();

router.post('/',    booksController.create);
router.get('/',     booksController.list);
router.get('/:id',  booksController.getById);
router.patch('/:id', booksController.update);
router.delete('/:id', booksController.remove);

module.exports = router;
