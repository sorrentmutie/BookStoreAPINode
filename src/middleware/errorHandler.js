'use strict';

/**
 * Global error handler.
 *
 * Intercetta tutti gli errori propagati via next(err) e li converte
 * nella risposta JSON standard:
 *   { error: { code, message, details? } }
 *
 * Formato atteso degli errori applicativi:
 *   { code: string, status: number, message: string, details?: array }
 *
 * Gli errori non riconosciuti vengono trattati come 500 INTERNAL_ERROR.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status  = err.status  || 500;
  const code    = err.code    || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred';

  const body = { error: { code, message } };

  if (err.details && err.details.length > 0) {
    body.error.details = err.details;
  }

  // Non esporre stack trace in produzione
  if (process.env.NODE_ENV !== 'production' && status === 500) {
    console.error(err);
  }

  res.status(status).json(body);
}

module.exports = errorHandler;
