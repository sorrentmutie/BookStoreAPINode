'use strict';

// Fixed window in-memory rate limiter: 100 req/min per API Key.
// Map<apiKeyId, { count: number, windowStart: number }>
const store = new Map();

const WINDOW_MS    = 60 * 1000; // 60 secondi
const MAX_REQUESTS = 100;

/**
 * Middleware rate limiting per-API-Key.
 *
 * Aggiunge sempre gli header:
 *   X-RateLimit-Limit     — limite massimo
 *   X-RateLimit-Remaining — richieste rimanenti nella finestra corrente
 *   X-RateLimit-Reset     — timestamp Unix (secondi) di reset della finestra
 *
 * Se il limite è superato risponde 429 con Retry-After.
 */
function rateLimiter(req, res, next) {
  const keyId = req.apiKey.id;
  const now   = Date.now();
  const entry = store.get(keyId);

  let count, windowStart;

  if (!entry || (now - entry.windowStart) >= WINDOW_MS) {
    windowStart = now;
    count = 1;
  } else {
    windowStart = entry.windowStart;
    count = entry.count + 1;
  }

  store.set(keyId, { count, windowStart });

  const remaining        = Math.max(0, MAX_REQUESTS - count);
  const resetEpochSecs   = Math.ceil((windowStart + WINDOW_MS) / 1000);

  res.set('X-RateLimit-Limit',     String(MAX_REQUESTS));
  res.set('X-RateLimit-Remaining', String(remaining));
  res.set('X-RateLimit-Reset',     String(resetEpochSecs));

  if (count > MAX_REQUESTS) {
    const retryAfter = resetEpochSecs - Math.floor(now / 1000);
    res.set('Retry-After', String(retryAfter));
    return next({ code: 'RATE_LIMIT_EXCEEDED', status: 429, message: 'Rate limit exceeded' });
  }

  next();
}

module.exports = rateLimiter;
