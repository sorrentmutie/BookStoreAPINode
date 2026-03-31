'use strict';

const { Router } = require('express');
const publishersController = require('../controllers/publishers');

const router = Router();

router.post('/',     publishersController.create);
router.get('/',      publishersController.list);
router.get('/:id',   publishersController.getById);
router.patch('/:id', publishersController.update);
router.delete('/:id', publishersController.remove);

module.exports = router;
