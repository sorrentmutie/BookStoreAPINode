'use strict';

const express = require('express');
const authMiddleware = require('./middleware/auth');
const rateLimiter = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

const booksRouter = require('./routes/books');
const authorsRouter = require('./routes/authors');
const publishersRouter = require('./routes/publishers');
const genresRouter = require('./routes/genres');

const app = express();

// 1. Body parser
app.use(express.json());

// 2. Autenticazione (blocca tutto il traffico non autenticato)
app.use(authMiddleware);

// 3. Rate limiting (per-API-Key, richiede req.apiKey impostato da auth)
app.use(rateLimiter);

// 4. Router per risorsa
app.use('/api/v1/books',      booksRouter);
app.use('/api/v1/authors',    authorsRouter);
app.use('/api/v1/publishers', publishersRouter);
app.use('/api/v1/genres',     genresRouter);

// 5. 404 per rotte non matchate
app.use((req, res, next) => {
  next({ code: 'NOT_FOUND', status: 404, message: 'Endpoint not found' });
});

// 6. Global error handler
app.use(errorHandler);

module.exports = app;
