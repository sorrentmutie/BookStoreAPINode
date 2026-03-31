'use strict';

const apiKeysRepository = require('../repositories/apiKeys');

/**
 * Middleware di autenticazione via API Key.
 *
 * Legge l'header X-API-Key, lo valida contro il DB.
 * In caso di successo imposta req.apiKey = { id, key, client_name }.
 * Altrimenti passa un errore al global error handler.
 */
function authMiddleware(req, res, next) {
  const key = req.headers['x-api-key'];

  if (!key) {
    return next({ code: 'MISSING_API_KEY', status: 401, message: 'Missing X-API-Key header' });
  }

  const apiKey = apiKeysRepository.findByKey(key);

  if (!apiKey) {
    return next({ code: 'INVALID_API_KEY', status: 401, message: 'Invalid API key' });
  }

  req.apiKey = apiKey;
  next();
}

module.exports = authMiddleware;
