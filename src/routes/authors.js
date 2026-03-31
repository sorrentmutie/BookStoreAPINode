'use strict';

const { Router } = require('express');
const authorsController = require('../controllers/authors');

const router = Router();

router.post('/',     authorsController.create);
router.get('/',      authorsController.list);
router.get('/:id',   authorsController.getById);
router.patch('/:id', authorsController.update);
router.delete('/:id', authorsController.remove);

module.exports = router;
