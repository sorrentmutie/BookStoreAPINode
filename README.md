# BookStore API

REST API per la gestione inventario di una libreria, costruita con Node.js ed Express 5.

## Stack

| Componente | Tecnologia |
|---|---|
| Runtime | Node.js |
| Framework | Express 5 |
| Database | SQLite via `better-sqlite3` (API sincrona) |
| Validazione | Joi |
| Testing | Jest + Supertest |
| Dev server | nodemon |

---

## Setup

### Prerequisiti

- Node.js >= 18
- npm >= 9

### Installazione

```bash
git clone <repo-url>
cd BookStoreAPINode
npm install
```

### Variabili d'ambiente

Crea un file `.env` nella root (opzionale — i default funzionano per lo sviluppo):

```env
PORT=3000
DB_PATH=bookstore.db
```

### Avvio

```bash
# Sviluppo (auto-reload)
npm run dev

# Produzione
npm start
```

La API sarà disponibile su `http://localhost:3000`.

---

## Autenticazione

Ogni richiesta richiede l'header `X-API-Key`:

```
X-API-Key: dev-key-1234
```

Il seed inserisce automaticamente la chiave `dev-key-1234` al primo avvio. Senza questo header la risposta è `401 MISSING_API_KEY`.

---

## Rate Limiting

100 richieste per minuto per API Key. Response headers:

| Header | Descrizione |
|---|---|
| `X-RateLimit-Limit` | Limite massimo (100) |
| `X-RateLimit-Remaining` | Richieste rimanenti nella finestra |
| `X-RateLimit-Reset` | Timestamp Unix di reset |
| `Retry-After` | Secondi di attesa (solo su 429) |

---

## Architettura

```
src/
├── server.js          # Entry point: carica .env, avvia il server
├── app.js             # Express setup: middleware globali, mount routes
├── database.js        # Inizializzazione SQLite, schema, seed
├── controllers/       # Layer HTTP: validazione input, risposta JSON
│   ├── books.js
│   ├── authors.js
│   ├── publishers.js
│   └── genres.js
├── repositories/      # Layer dati: query SQLite (solo logica DB)
│   ├── books.js
│   ├── authors.js
│   ├── publishers.js
│   ├── genres.js
│   └── apiKeys.js
├── routes/            # Express Router per risorsa
│   ├── books.js
│   ├── authors.js
│   ├── publishers.js
│   └── genres.js
├── validators/        # Schemi Joi
│   ├── books.js
│   ├── authors.js
│   ├── publishers.js
│   └── common.js      # validateId, validatePagination
└── middleware/
    ├── auth.js        # X-API-Key validation
    ├── rateLimiter.js # Fixed window, 100 req/min per key
    └── errorHandler.js# Global error handler → { error: { code, message } }
```

### Pipeline middleware (in ordine)

```
Request → express.json() → auth → rateLimiter → router → 404 → errorHandler
```

### Schema database

```
publishers  (id, name, created_at, updated_at)
authors     (id, first_name, last_name, birth_date, biography, nationality, created_at, updated_at)
genres      (id, name UNIQUE)  ← pre-seeded, read-only
books       (id, title, isbn UNIQUE, price, quantity, publication_year, description,
             publisher_id FK, author, category, created_at, updated_at)
book_authors (book_id FK, author_id FK)  ← many-to-many
book_genres  (book_id FK, genre_id FK)   ← many-to-many
api_keys    (id, key UNIQUE, client_name, created_at)
```

---

## API Reference

### Formato risposta

**Successo (singolo):**
```json
{ "data": { ... } }
```

**Successo (lista):**
```json
{
  "data": [ ... ],
  "meta": { "page": 1, "limit": 20, "total": 42 }
}
```

**Errore:**
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Descrizione leggibile",
    "details": [ { "field": "isbn", "message": "..." } ]
  }
}
```

---

### Books

#### `POST /api/v1/books`

Crea un nuovo libro.

**Body:**
```json
{
  "title": "Il Nome della Rosa",
  "isbn": "9780156001311",
  "author": "Umberto Eco",
  "price": 12.99,
  "category": "Fiction"
}
```

| Campo | Tipo | Obbligatorio | Note |
|---|---|---|---|
| `title` | string | SI | max 200 caratteri |
| `isbn` | string | SI | formato ISBN-13 (13 cifre, trattini ammessi) |
| `author` | string | SI | |
| `price` | number | SI | deve essere > 0 |
| `category` | string | SI | uno dei 11 generi validi |

**Risposte:** `201 Created` · `400 VALIDATION_ERROR` · `409 DUPLICATE_ISBN` · `401 MISSING_API_KEY`

---

#### `GET /api/v1/books`

Lista paginata con filtri opzionali.

**Query params:**
| Param | Tipo | Default | Descrizione |
|---|---|---|---|
| `page` | integer | 1 | Pagina |
| `limit` | integer | 20 | Max 100 |
| `title` | string | — | Ricerca parziale, case-insensitive |
| `author_id` | integer | — | Filtra per autore |
| `genre_id` | integer | — | Filtra per genere |
| `publisher_id` | integer | — | Filtra per editore |
| `available` | boolean | — | `true` = quantity > 0 |
| `sort` | string | `title` | `title` · `price` · `publication_year` |
| `order` | string | `asc` | `asc` · `desc` |

**Campo calcolato:** ogni libro ha `low_stock: true` se `quantity <= 5`.

**Risposte:** `200 OK` · `400 VALIDATION_ERROR` · `401`

---

#### `GET /api/v1/books/:id`

Dettaglio libro con eager loading di publisher, authors, genres.

**Risposte:** `200 OK` · `404 NOT_FOUND` · `400 VALIDATION_ERROR`

---

#### `PATCH /api/v1/books/:id`

Aggiornamento parziale. Solo i campi inviati vengono modificati.

**Risposte:** `200 OK` · `404 NOT_FOUND` · `400 VALIDATION_ERROR` · `409 DUPLICATE_ISBN`

---

#### `DELETE /api/v1/books/:id`

**Risposte:** `204 No Content` · `404 NOT_FOUND`

---

### Authors

#### `POST /api/v1/authors`

| Campo | Tipo | Obbligatorio |
|---|---|---|
| `first_name` | string | SI |
| `last_name` | string | SI |
| `birth_date` | string (YYYY-MM-DD) | NO |
| `biography` | string | NO |
| `nationality` | string | NO |

**Risposte:** `201 Created` · `400 VALIDATION_ERROR`

---

#### `GET /api/v1/authors`

**Query params:** `page`, `limit`, `search` (ricerca su first_name e last_name)

**Risposte:** `200 OK`

---

#### `GET /api/v1/authors/:id`

Ritorna l'autore con l'array `books` dei libri associati.

**Risposte:** `200 OK` · `404 AUTHOR_NOT_FOUND`

---

#### `PATCH /api/v1/authors/:id`

Aggiornamento parziale.

**Risposte:** `200 OK` · `404 AUTHOR_NOT_FOUND` · `400 VALIDATION_ERROR`

---

#### `DELETE /api/v1/authors/:id`

**Risposte:** `204 No Content` · `404 AUTHOR_NOT_FOUND` · `409 AUTHOR_HAS_BOOKS`

---

### Publishers

#### `POST /api/v1/publishers`

| Campo | Tipo | Obbligatorio |
|---|---|---|
| `name` | string | SI |

**Risposte:** `201 Created` · `400 VALIDATION_ERROR` · `409 DUPLICATE_NAME`

---

#### `GET /api/v1/publishers`

**Query params:** `page`, `limit`, `search`

**Risposte:** `200 OK`

---

#### `GET /api/v1/publishers/:id`

Ritorna l'editore con il campo `book_count`.

**Risposte:** `200 OK` · `404 PUBLISHER_NOT_FOUND`

---

#### `PATCH /api/v1/publishers/:id`

**Risposte:** `200 OK` · `404 PUBLISHER_NOT_FOUND` · `409 DUPLICATE_NAME`

---

#### `DELETE /api/v1/publishers/:id`

**Risposte:** `204 No Content` · `404 PUBLISHER_NOT_FOUND` · `409 PUBLISHER_HAS_BOOKS`

---

### Genres (sola lettura)

Pre-seeded con 11 generi: Fiction, Non-Fiction, Sci-Fi, Fantasy, Romance, Thriller, Horror, Biography, History, Science, Children.

Tutte le operazioni di scrittura restituiscono `405 METHOD_NOT_ALLOWED`.

#### `GET /api/v1/genres`

Lista completa non paginata.

**Risposta:** `200 OK` con `{ "data": [ { "id": 1, "name": "Fiction" }, ... ] }`

---

#### `GET /api/v1/genres/:id`

Ritorna il genere con il campo `book_count`.

**Risposte:** `200 OK` · `404 GENRE_NOT_FOUND`

---

## Codici di errore

| Codice | Status | Descrizione |
|---|---|---|
| `MISSING_API_KEY` | 401 | Header X-API-Key assente |
| `INVALID_API_KEY` | 401 | Chiave non riconosciuta |
| `RATE_LIMIT_EXCEEDED` | 429 | Superato limite di 100 req/min |
| `VALIDATION_ERROR` | 400 | Body o query params non validi |
| `NOT_FOUND` | 404 | Risorsa generica non trovata |
| `AUTHOR_NOT_FOUND` | 404 | Autore non trovato |
| `PUBLISHER_NOT_FOUND` | 404 | Editore non trovato |
| `GENRE_NOT_FOUND` | 404 | Genere non trovato |
| `DUPLICATE_ISBN` | 409 | ISBN già presente |
| `DUPLICATE_NAME` | 409 | Nome editore già presente |
| `AUTHOR_HAS_BOOKS` | 409 | Impossibile eliminare autore con libri |
| `PUBLISHER_HAS_BOOKS` | 409 | Impossibile eliminare editore con libri |
| `METHOD_NOT_ALLOWED` | 405 | Operazione non consentita (genres) |
| `INTERNAL_ERROR` | 500 | Errore interno non gestito |

---

## Testing

```bash
# Tutti i test
npm test

# File singolo
npx jest tests/integration/books.test.js

# Con coverage
npx jest --coverage
```

I test usano un database SQLite in-memory (`:memory:`) isolato dal DB di sviluppo.
