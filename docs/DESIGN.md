# Design Tecnico — BookStore API

**Versione**: 1.0  
**Data**: 2026-03-31  
**Stato**: Approvato  
**Riferimento spec**: `docs/SPEC.md` v1.0

---

## Indice

1. [Struttura file del progetto](#1-struttura-file-del-progetto)
2. [Schema database](#2-schema-database)
3. [Architettura a layer](#3-architettura-a-layer)
4. [Middleware pipeline](#4-middleware-pipeline)
5. [Design rate limiter in-memory](#5-design-rate-limiter-in-memory)
6. [Struttura db/](#6-struttura-db)
7. [Struttura validators/](#7-struttura-validators)
8. [Gestione errori](#8-gestione-errori)
9. [Seed data](#9-seed-data)
10. [Decisioni architetturali](#10-decisioni-architetturali)

---

## 1. Struttura file del progetto

```
bookstore-api/
│
├── index.js                    # Entry point: crea app Express, monta middleware globali,
│                               # monta router, avvia server. Non contiene logica di business.
│
├── db/
│   ├── connection.js           # Apre la connessione better-sqlite3, abilita foreign_keys,
│   │                           # esporta l'istanza singleton `db` usata da tutti i query helpers.
│   ├── schema.js               # Esegue le CREATE TABLE IF NOT EXISTS all'avvio.
│   │                           # Chiamato una sola volta da connection.js dopo l'apertura.
│   ├── seed.js                 # Inserisce i dati iniziali (genres + api_key di sviluppo).
│   │                           # Idempotente: usa INSERT OR IGNORE.
│   ├── books.js                # Query helpers per la risorsa books (vedi §6).
│   ├── authors.js              # Query helpers per la risorsa authors.
│   ├── publishers.js           # Query helpers per la risorsa publishers.
│   ├── genres.js               # Query helpers per la risorsa genres (solo lettura).
│   └── apiKeys.js              # Query helper per validare una API key.
│
├── routes/
│   ├── books.js                # Express Router per /api/v1/books.
│   │                           # Orchestrazione: chiama validator → db helper → forma risposta.
│   ├── authors.js              # Express Router per /api/v1/authors.
│   ├── publishers.js           # Express Router per /api/v1/publishers.
│   └── genres.js               # Express Router per /api/v1/genres.
│                               # Restituisce 405 su POST/PATCH/DELETE.
│
├── validators/
│   ├── books.js                # Joi schema per POST body, PATCH body, query params GET lista.
│   ├── authors.js              # Joi schema per POST body, PATCH body.
│   ├── publishers.js           # Joi schema per POST body, PATCH body.
│   └── common.js               # Schema riutilizzabili: paginazione, id numerico URL param.
│
├── middleware/
│   ├── auth.js                 # Legge X-API-Key, valida contro DB, espone req.apiKey.
│   ├── rateLimiter.js          # Fixed window in-memory per API Key (vedi §5).
│   └── errorHandler.js         # Global error handler: mappa errori → risposta JSON standard.
│
├── tests/
│   ├── setup.js                # Inizializza DB :memory: prima di ogni suite, carica seed.
│   ├── books.test.js           # Integration test end-to-end per /api/v1/books.
│   ├── authors.test.js         # Integration test per /api/v1/authors.
│   ├── publishers.test.js      # Integration test per /api/v1/publishers.
│   └── genres.test.js          # Integration test per /api/v1/genres.
│
├── .env.example                # Variabili d'ambiente documentate (DB_PATH, PORT).
├── package.json
└── CLAUDE.md
```

### Variabili d'ambiente

| Variabile | Default | Descrizione |
|---|---|---|
| `PORT` | `3000` | Porta HTTP del server |
| `DB_PATH` | `./bookstore.db` | Path del file SQLite (ignorato in test: usa `:memory:`) |

---

## 2. Schema database

### DDL completo

```sql
-- Abilitato all'apertura della connessione, non nel DDL:
-- PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS publishers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS authors (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name   TEXT    NOT NULL,
    last_name    TEXT    NOT NULL,
    birth_date   TEXT,                  -- formato YYYY-MM-DD, NULLABLE
    biography    TEXT,
    nationality  TEXT,
    created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS genres (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT    NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS books (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    title             TEXT    NOT NULL,
    isbn              TEXT    NOT NULL UNIQUE,
    price             REAL    NOT NULL CHECK (price >= 0),
    quantity          INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    publication_year  INTEGER NOT NULL,
    description       TEXT,
    publisher_id      INTEGER NOT NULL REFERENCES publishers(id),
    created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS book_authors (
    book_id    INTEGER NOT NULL REFERENCES books(id)   ON DELETE CASCADE,
    author_id  INTEGER NOT NULL REFERENCES authors(id) ON DELETE RESTRICT,
    PRIMARY KEY (book_id, author_id)
);

CREATE TABLE IF NOT EXISTS book_genres (
    book_id   INTEGER NOT NULL REFERENCES books(id)  ON DELETE CASCADE,
    genre_id  INTEGER NOT NULL REFERENCES genres(id) ON DELETE RESTRICT,
    PRIMARY KEY (book_id, genre_id)
);

CREATE TABLE IF NOT EXISTS api_keys (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    key          TEXT    NOT NULL UNIQUE,
    client_name  TEXT    NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Indici espliciti (isbn è già coperto dal UNIQUE constraint)
CREATE INDEX IF NOT EXISTS idx_books_title        ON books(title);
CREATE INDEX IF NOT EXISTS idx_books_publisher_id ON books(publisher_id);
CREATE INDEX IF NOT EXISTS idx_book_authors_author_id ON book_authors(author_id);
CREATE INDEX IF NOT EXISTS idx_book_genres_genre_id   ON book_genres(genre_id);
```

### Note sul DDL

- `publishers` è dichiarata prima di `books` per rispettare l'ordine delle FK.
- `updated_at` usa `strftime` con milliseconds (`%f`) per produrre timestamp ISO 8601 completi.
  I PATCH devono aggiornare questo campo manualmente nel query helper (SQLite non ha trigger
  automatici `ON UPDATE`).
- I `CHECK` constraints su `price` e `quantity` forniscono un secondo livello di difesa oltre
  alla validazione Joi. Se Joi fallisce, il constraint DB non viene mai raggiunto. Se Joi è
  bypassato (bug), il DB rigetta comunque i valori invalidi.
- `ON DELETE CASCADE` sulle tabelle ponte (`book_authors`, `book_genres`) implementa la pulizia
  automatica delle relazioni quando un libro viene eliminato (hard delete).
- `ON DELETE RESTRICT` su `author_id` e `genre_id` nelle tabelle ponte non è necessario per la
  nostra logica (la cancellazione di autori/publisher con dipendenze è gestita esplicitamente nel
  db layer), ma documenta l'intenzione nel DDL.

---

## 3. Architettura a layer

### Separazione delle responsabilità

```
HTTP Request
     |
     v
[ middleware/auth.js ]          ← Legge header, valida API Key contro DB
     |
     v
[ middleware/rateLimiter.js ]   ← Controlla e aggiorna contatore in-memory
     |
     v
[ routes/*.js ]                 ← Estrae parametri HTTP, chiama validator, chiama db helper,
     |                            forma la risposta JSON. ZERO logica di dominio qui.
     |
     +---> [ validators/*.js ]  ← Valida e normalizza input (Joi). Restituisce dati puliti
     |                            o lancia ValidationError con i dettagli dei campi.
     |
     +---> [ db/*.js ]          ← Esegue query SQL con prepared statements.
                                  Gestisce transazioni. Restituisce oggetti JS puri.
                                  Non conosce req/res/next.
```

### Principio chiave: il db layer non conosce HTTP

Le funzioni in `db/` ricevono e restituiscono dati plain JS. Non lanciano mai errori HTTP
(come `res.status(404)`). Restituiscono `null` se una risorsa non esiste, e il route handler
decide cosa rispondere.

Esempio di contratto:

```js
// db/books.js — restituisce null se non trovato, mai 404
function getBookById(id) { /* ... */ }

// routes/books.js — gestisce il caso null
router.get('/:id', (req, res, next) => {
  const book = getBookById(req.params.id);
  if (!book) return next({ code: 'NOT_FOUND', status: 404 });
  res.json({ data: book });
});
```

### Calcolo di `low_stock`

Il flag `low_stock` è un campo calcolato, non persistito. Viene aggiunto nel route handler
dopo aver ricevuto i dati dal db layer:

```js
// Applicato sia nella lista che nel dettaglio
function addLowStock(book) {
  return { ...book, low_stock: book.quantity <= 5 };
}
```

Questa scelta mantiene la definizione di "low stock" in un unico punto nel codice applicativo,
non distribuita tra query SQL e JS.

---

## 4. Middleware pipeline

### Ordine di montaggio in `index.js`

```js
// 1. Parser
app.use(express.json());

// 2. Autenticazione — blocca tutto il traffico non autenticato
app.use(authMiddleware);

// 3. Rate limiting — dopo auth, perché il limit è per-API-Key
app.use(rateLimiterMiddleware);

// 4. Router per risorsa
app.use('/api/v1/books',      booksRouter);
app.use('/api/v1/authors',    authorsRouter);
app.use('/api/v1/publishers', publishersRouter);
app.use('/api/v1/genres',     genresRouter);

// 5. 404 handler — rotte non matchate
app.use((req, res, next) => {
  next({ code: 'NOT_FOUND', status: 404, message: 'Endpoint not found' });
});

// 6. Global error handler — deve avere 4 parametri (err, req, res, next)
app.use(errorHandler);
```

### Dettaglio middleware

#### `middleware/auth.js`

Responsabilità: verificare che `X-API-Key` sia presente e valido.

```
1. Legge req.headers['x-api-key']
2. Se assente → next({ code: 'MISSING_API_KEY', status: 401 })
3. Chiama db/apiKeys.js findByKey(key)
4. Se non trovata → next({ code: 'INVALID_API_KEY', status: 401 })
5. Imposta req.apiKey = { id, key, client_name }
6. next()
```

La query di validazione API Key viene eseguita a ogni richiesta. Con pochi client (uso interno)
e SQLite in-memory (lookup O(1) sull'indice UNIQUE), il costo è trascurabile. Se il sistema
crescesse, si aggiungerebbe un cache in-memory delle chiavi valide.

#### `middleware/rateLimiter.js`

Responsabilità: applicare il limite di 100 req/min per API Key.  
Dettaglio implementativo al §5.

#### `middleware/errorHandler.js`

Responsabilità: intercettare tutti gli errori propagati via `next(err)` e restituire
la risposta JSON standard.  
Dettaglio al §8.

---

## 5. Design rate limiter in-memory

### Algoritmo: Fixed Window

La finestra è di 60 secondi. Il contatore si azzera alla scadenza della finestra corrente,
non in modo sliding. Scelta pragmatica: l'implementazione è O(1) per lookup e update, senza
strutture dati temporali complesse.

Trade-off accettato: un client può fare fino a 200 richieste in 2 secondi se le ultime 100
della finestra precedente sono nell'ultimo secondo e le prime 100 della nuova finestra
immediatamente dopo. Per uso interno con frontend applicativo, questo non è un vettore
di attacco rilevante.

### Struttura dati

```js
// Map<apiKeyId, { count: number, windowStart: number }>
const store = new Map();

// windowStart = timestamp Unix in millisecondi dell'inizio della finestra corrente
```

### Pseudocodice del middleware

```js
const WINDOW_MS = 60 * 1000;  // 60 secondi
const MAX_REQUESTS = 100;

function rateLimiter(req, res, next) {
  const keyId = req.apiKey.id;            // impostato da auth middleware
  const now = Date.now();
  const entry = store.get(keyId);

  let count, windowStart;

  if (!entry || (now - entry.windowStart) >= WINDOW_MS) {
    // Prima richiesta o finestra scaduta: reset
    windowStart = now;
    count = 1;
  } else {
    windowStart = entry.windowStart;
    count = entry.count + 1;
  }

  store.set(keyId, { count, windowStart });

  const remaining = Math.max(0, MAX_REQUESTS - count);
  const resetEpochSeconds = Math.ceil((windowStart + WINDOW_MS) / 1000);

  // Header sempre presenti, anche quando il limite è superato
  res.set('X-RateLimit-Limit',     String(MAX_REQUESTS));
  res.set('X-RateLimit-Remaining', String(remaining));
  res.set('X-RateLimit-Reset',     String(resetEpochSeconds));

  if (count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((windowStart + WINDOW_MS - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return next({ code: 'RATE_LIMIT_EXCEEDED', status: 429 });
  }

  next();
}
```

### Gestione memoria

La `Map` non viene mai pulita automaticamente in questo design. Con pochi client fissi
(uso interno), non è un problema: la Map avrà al massimo N entry dove N è il numero
di API Key registrate. Se il sistema dovesse supportare molti client dinamici, si
aggiungerebbe una pulizia periodica delle entry scadute con `setInterval`.

---

## 6. Struttura db/

### `db/connection.js`

```js
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'bookstore.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');   // migliora performance concorrenza lettura
db.pragma('foreign_keys = ON');    // OBBLIGATORIO per FK constraints

module.exports = db;
```

`WAL` (Write-Ahead Logging) è consigliato con SQLite per permettere letture concorrenti
durante una scrittura. Per uso single-process Node.js è comunque buona pratica.

### `db/books.js` — funzioni esportate

```js
// Lettura lista con filtri, paginazione, ordinamento
// Restituisce { books: [...], total: number }
getBooks({ title, author_id, genre_id, publisher_id, page, limit, sort, order })

// Lettura dettaglio con eager loading (publisher, authors[], genres[])
// Restituisce oggetto libro completo o null
getBookById(id)

// Inserisce libro + relazioni in transazione
// Restituisce il libro creato (come getBookById)
createBook({ title, isbn, price, quantity, publication_year, description, publisher_id, author_ids, genre_ids })

// Aggiornamento parziale + eventuale sostituzione relazioni in transazione
// Restituisce il libro aggiornato o null se non trovato
updateBook(id, { title, isbn, price, quantity, publication_year, description, publisher_id, author_ids, genre_ids })

// Hard delete del libro (CASCADE elimina book_authors e book_genres)
// Restituisce true se eliminato, false se non trovato
deleteBook(id)

// Helpers di supporto usati internamente e dalla route per validazioni FK
publisherExists(publisher_id)   // → boolean
authorsExist(author_ids)        // → { valid: boolean, missing: number[] }
genresExist(genre_ids)          // → { valid: boolean, missing: number[] }
```

### Pattern query lista libri

La query per `getBooks` costruisce dinamicamente le clausole WHERE e JOIN in base ai
parametri ricevuti. Le colonne di sort sono validate da Joi prima di arrivare qui,
quindi è sicuro interpolarle nell'ORDER BY. I valori dei filtri passano sempre
come parametri prepared.

```js
function getBooks({ title, author_id, genre_id, publisher_id, page, limit, sort, order }) {
  const ALLOWED_SORT = { title: 'b.title', price: 'b.price', publication_year: 'b.publication_year' };
  const orderCol = ALLOWED_SORT[sort] || 'b.title';
  const orderDir = order === 'desc' ? 'DESC' : 'ASC';

  const conditions = [];
  const params = [];

  if (title) {
    conditions.push("b.title LIKE ?");
    params.push(`%${title}%`);
  }
  if (publisher_id) {
    conditions.push("b.publisher_id = ?");
    params.push(publisher_id);
  }
  // author_id e genre_id richiedono JOIN sulle tabelle ponte
  // ...

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  // Query principale con GROUP_CONCAT per aggregare gli ID delle relazioni
  const rows = db.prepare(`
    SELECT
      b.*,
      GROUP_CONCAT(DISTINCT ba.author_id) AS author_ids_raw,
      GROUP_CONCAT(DISTINCT bg.genre_id)  AS genre_ids_raw
    FROM books b
    LEFT JOIN book_authors ba ON ba.book_id = b.id
    LEFT JOIN book_genres   bg ON bg.book_id = b.id
    ${author_id ? 'INNER JOIN book_authors ba2 ON ba2.book_id = b.id AND ba2.author_id = ?' : ''}
    ${genre_id  ? 'INNER JOIN book_genres  bg2 ON bg2.book_id = b.id AND bg2.genre_id  = ?' : ''}
    ${where}
    GROUP BY b.id
    ORDER BY ${orderCol} ${orderDir}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  // Parsing di GROUP_CONCAT → array di interi
  const books = rows.map(r => ({
    ...r,
    author_ids: r.author_ids_raw ? r.author_ids_raw.split(',').map(Number) : [],
    genre_ids:  r.genre_ids_raw  ? r.genre_ids_raw.split(',').map(Number)  : [],
    author_ids_raw: undefined,
    genre_ids_raw:  undefined,
  }));

  // Query COUNT separata (stessi filtri, senza LIMIT/OFFSET/GROUP BY)
  const { total } = db.prepare(`SELECT COUNT(DISTINCT b.id) AS total FROM books b ...`).get(...params);

  return { books, total };
}
```

### Pattern transazione createBook

```js
const createBook = db.transaction((bookData, author_ids, genre_ids) => {
  const result = db.prepare(
    `INSERT INTO books (title, isbn, price, quantity, publication_year, description, publisher_id)
     VALUES (@title, @isbn, @price, @quantity, @publication_year, @description, @publisher_id)`
  ).run(bookData);
  // Se isbn duplicato: better-sqlite3 lancia SqliteError con code SQLITE_CONSTRAINT_UNIQUE

  const bookId = result.lastInsertRowid;

  const insertAuthor = db.prepare('INSERT INTO book_authors (book_id, author_id) VALUES (?, ?)');
  for (const authorId of author_ids) insertAuthor.run(bookId, authorId);

  const insertGenre = db.prepare('INSERT INTO book_genres (book_id, genre_id) VALUES (?, ?)');
  for (const genreId of genre_ids) insertGenre.run(bookId, genreId);

  return getBookById(bookId);  // lettura del risultato finale
});
```

### `db/authors.js` — funzioni esportate

```js
getAuthors({ page, limit })          // → { authors: [...], total }
getAuthorById(id)                    // → author | null
createAuthor(data)                   // → author creato
updateAuthor(id, data)               // → author aggiornato | null
deleteAuthor(id)                     // → true | false
hasBooks(authorId)                   // → boolean (controlla book_authors)
```

### `db/publishers.js` — funzioni esportate

```js
getPublishers({ page, limit })       // → { publishers: [...], total }
getPublisherById(id)                 // → publisher | null
createPublisher(data)                // → publisher creato
updatePublisher(id, data)            // → publisher aggiornato | null
deletePublisher(id)                  // → true | false
hasBooks(publisherId)                // → boolean (controlla books.publisher_id)
```

### `db/genres.js` — funzioni esportate

```js
getGenres()        // → genres[] (lista completa, no paginazione)
getGenreById(id)   // → genre | null
```

### `db/apiKeys.js` — funzioni esportate

```js
findByKey(key)   // → { id, key, client_name, created_at } | null
```

---

## 7. Struttura validators/

### `validators/common.js`

Schemi riutilizzabili importati dagli altri validator file.

```js
const Joi = require('joi');

// Validazione id numerico da URL param (es. /books/:id)
const idParam = Joi.object({
  id: Joi.number().integer().positive().required()
});

// Paginazione standard per GET liste
const pagination = {
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
};

module.exports = { idParam, pagination };
```

### `validators/books.js`

```js
const Joi = require('joi');
const { pagination } = require('./common');

// Validazione ISBN-10 con check digit
// L'ultimo carattere può essere 'X' (valore 10)
function isValidIsbn10(isbn) {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  const digits = isbn.toUpperCase().split('');
  const sum = digits.reduce((acc, d, i) => {
    const val = d === 'X' ? 10 : parseInt(d);
    return acc + val * (10 - i);
  }, 0);
  return sum % 11 === 0;
}

// Schema per POST /books
const createBook = Joi.object({
  title:            Joi.string().min(1).required(),
  isbn:             Joi.string().custom((value, helpers) => {
                      if (!isValidIsbn10(value)) return helpers.error('any.invalid');
                      return value;
                    }).required().messages({ 'any.invalid': 'ISBN-10 format is invalid (check digit mismatch)' }),
  price:            Joi.number().min(0).required(),
  quantity:         Joi.number().integer().min(0).required(),
  publication_year: Joi.number().integer().required(),
  description:      Joi.string().allow('', null).optional(),
  publisher_id:     Joi.number().integer().positive().required(),
  author_ids:       Joi.array().items(Joi.number().integer().positive()).min(1).required(),
  genre_ids:        Joi.array().items(Joi.number().integer().positive()).min(1).required(),
});

// Schema per PATCH /books/:id
// Tutti i campi opzionali; almeno un campo deve essere presente
const updateBook = Joi.object({
  title:            Joi.string().min(1),
  isbn:             Joi.string().custom(/* stessa validazione ISBN */),
  price:            Joi.number().min(0),
  quantity:         Joi.number().integer().min(0),
  publication_year: Joi.number().integer(),
  description:      Joi.string().allow('', null),
  publisher_id:     Joi.number().integer().positive(),
  author_ids:       Joi.array().items(Joi.number().integer().positive()).min(1),
  genre_ids:        Joi.array().items(Joi.number().integer().positive()).min(1),
}).min(0);  // body vuoto {} è accettato (restituisce libro invariato)

// Schema per query params GET /books
const listBooks = Joi.object({
  title:        Joi.string().optional(),
  author_id:    Joi.number().integer().positive().optional(),
  genre_id:     Joi.number().integer().positive().optional(),
  publisher_id: Joi.number().integer().positive().optional(),
  sort:         Joi.string().valid('title', 'price', 'publication_year').default('title'),
  order:        Joi.string().valid('asc', 'desc').default('asc'),
  ...pagination,
});

module.exports = { createBook, updateBook, listBooks };
```

### `validators/authors.js`

```js
const createAuthor = Joi.object({
  first_name:  Joi.string().min(1).required(),
  last_name:   Joi.string().min(1).required(),
  birth_date:  Joi.string().isoDate().optional().allow(null),
  biography:   Joi.string().allow('', null).optional(),
  nationality: Joi.string().allow('', null).optional(),
});

const updateAuthor = Joi.object({
  first_name:  Joi.string().min(1),
  last_name:   Joi.string().min(1),
  birth_date:  Joi.string().isoDate().optional().allow(null),
  biography:   Joi.string().allow('', null),
  nationality: Joi.string().allow('', null),
}).min(0);
```

### `validators/publishers.js`

```js
const createPublisher = Joi.object({
  name: Joi.string().min(1).required(),
});

const updatePublisher = Joi.object({
  name: Joi.string().min(1),
}).min(1);  // PATCH publisher senza body non ha senso: name è l'unico campo
```

### Pattern di utilizzo nei route handler

I validator non sono middleware separati: vengono chiamati direttamente nel route handler
prima di invocare il db layer. Questo mantiene il flusso esplicito e leggibile senza
astrazioni magiche.

```js
// Esempio in routes/books.js
router.post('/', (req, res, next) => {
  const { error, value } = createBookSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return next({
      code: 'VALIDATION_ERROR',
      status: 400,
      details: error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
    });
  }
  // value contiene i dati validati e normalizzati (default applicati)
  // ...
});
```

L'opzione `abortEarly: false` è necessaria per restituire tutti i campi invalidi
nella risposta di errore, non solo il primo.

---

## 8. Gestione errori

### Gerarchia degli errori applicativi

Tutti gli errori vengono propagati tramite `next(err)` come oggetti plain con questa forma:

```js
{
  code:    'NOT_FOUND',        // string machine-readable
  status:  404,                // HTTP status code
  message: 'Book not found',   // string human-readable (opzionale)
  details: []                  // array di { field, message } (solo per VALIDATION_ERROR)
}
```

Non vengono usate classi di errore custom. Per questo progetto, oggetti plain sono
sufficienti e mantengono il codice semplice.

### `middleware/errorHandler.js`

```js
function errorHandler(err, req, res, next) {
  // Errori applicativi (propagati con next({ code, status, ... }))
  if (err.code && err.status) {
    return res.status(err.status).json({
      error: {
        code:    err.code,
        message: err.message || defaultMessages[err.code] || 'An error occurred',
        details: err.details || [],
      }
    });
  }

  // Errori SQLite — intercettati qui se sfuggono al db layer
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    // Fallback: non dovrebbe arrivare qui se il db layer gestisce correttamente
    return res.status(409).json({
      error: { code: 'DUPLICATE_ISBN', message: 'ISBN already exists', details: [] }
    });
  }

  // Errori Express 5 — es. body JSON malformato
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body', details: [] }
    });
  }

  // Errore interno non gestito
  console.error('[INTERNAL_ERROR]', err);  // log solo per errori imprevisti
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: [] }
  });
}
```

### Mappatura completa errori → HTTP

| Scenario | Code | HTTP Status | Note |
|---|---|---|---|
| Header X-API-Key assente | `MISSING_API_KEY` | 401 | Generato da `auth.js` |
| API Key non trovata in DB | `INVALID_API_KEY` | 401 | Generato da `auth.js` |
| Rate limit superato | `RATE_LIMIT_EXCEEDED` | 429 | Generato da `rateLimiter.js` + `Retry-After` header |
| Validazione Joi fallita | `VALIDATION_ERROR` | 400 | Dettagli per campo in `details[]` |
| ID non numerico in URL | `VALIDATION_ERROR` | 400 | Validato in route prima del db layer |
| Risorsa non trovata per ID | `NOT_FOUND` | 404 | Il db layer restituisce null, il route fa next() |
| Metodo non permesso (genres) | `METHOD_NOT_ALLOWED` | 405 | Gestito nel router genres con handler esplicito |
| ISBN duplicato | `DUPLICATE_ISBN` | 409 | Intercettato da `SqliteError.code === 'SQLITE_CONSTRAINT_UNIQUE'` nel db layer |
| Autore/Publisher con libri | `HAS_DEPENDENCIES` | 409 | Verificato con `hasBooks()` prima del DELETE |
| publisher_id/author_ids/genre_ids inesistenti | `VALIDATION_ERROR` | 400 | Verificato con helpers FK prima della transazione |
| Errore interno imprevisto | `INTERNAL_ERROR` | 500 | Loggato; dettagli non esposti al client |

### Gestione 405 per /genres

```js
// routes/genres.js
router.get('/',    /* handler lista */);
router.get('/:id', /* handler dettaglio */);

// Catch-all per tutti gli altri metodi su qualsiasi path di genres
router.all('*', (req, res, next) => {
  next({ code: 'METHOD_NOT_ALLOWED', status: 405 });
});
```

### Intercettazione SQLITE_CONSTRAINT_UNIQUE nel db layer

```js
// In db/books.js, all'interno della transazione createBook o updateBook:
try {
  const result = insertStmt.run(bookData);
  // ...
} catch (err) {
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    throw { code: 'DUPLICATE_ISBN', status: 409 };
  }
  throw err;  // rilancia errori non gestiti
}
```

Il db layer intercetta l'errore SQLite e lo riconverte in un errore applicativo
con `code` e `status`, che il route handler propaga via `next(err)`.

---

## 9. Seed data

### `db/seed.js`

Il seed è idempotente grazie a `INSERT OR IGNORE`. Può essere chiamato ogni volta
che l'applicazione si avvia senza effetti collaterali.

```js
const db = require('./connection');

function seed() {
  const genres = [
    'Fiction', 'Non-Fiction', 'Sci-Fi', 'Fantasy', 'Romance',
    'Thriller', 'Horror', 'Biography', 'History', 'Science', 'Children'
  ];

  const insertGenre = db.prepare('INSERT OR IGNORE INTO genres (name) VALUES (?)');
  for (const name of genres) insertGenre.run(name);

  // API Key di sviluppo
  // NOTA: in produzione, generare chiavi con crypto.randomUUID() o simili
  // e non committarle nel codice sorgente
  db.prepare(
    'INSERT OR IGNORE INTO api_keys (key, client_name) VALUES (?, ?)'
  ).run('dev-api-key-change-in-production', 'Development Client');
}

module.exports = seed;
```

### Invocazione del seed

```js
// In db/connection.js, dopo aver aperto la connessione e creato lo schema:
const { initSchema } = require('./schema');
const seed = require('./seed');

initSchema();
seed();
```

### Seed in ambiente di test

Nei test (`tests/setup.js`), il DB è in-memory e viene ricreato per ogni suite.
Il seed viene chiamato dallo stesso `setup.js` per garantire la presenza dei generi
e di un'API Key valida in ogni test:

```js
// tests/setup.js
process.env.DB_PATH = ':memory:';
const db = require('../db/connection');  // apre :memory:, chiama schema + seed

// Supertest monterà l'app che usa la stessa istanza db
```

---

## 10. Decisioni architetturali

| # | Decisione | Alternativa scartata | Motivazione |
|---|---|---|---|
| 1 | **Singleton `db` connection** esportato da `connection.js` | Aprire una nuova connessione per ogni richiesta | better-sqlite3 è sincrono; una connessione condivisa è il pattern standard. Aprire/chiudere per richiesta avrebbe overhead inutile. |
| 2 | **Validator chiamati inline nel route handler** (non come middleware separato) | `validateMiddleware(schema)` factory applicata prima del handler | Rende il flusso esplicito e leggibile. Il middleware factory è un'astrazione utile solo se si hanno decine di route; con 4 risorse, aggiunge complessità senza benefici. |
| 3 | **Errori propagati come oggetti plain** via `next(err)`, non classi custom | Classi `NotFoundError extends Error`, `ValidationError extends Error` | Le classi custom sono utili quando si fa `instanceof` checking. Con un unico errorHandler che legge `err.code`, sono sovra-ingegnerizzate per questo progetto. |
| 4 | **`low_stock` calcolato nel route handler JS**, non in SQL | `CASE WHEN quantity <= 5 THEN 1 ELSE 0 END AS low_stock` nella query | La soglia 5 è una regola di business: definita una sola volta in JS è più manutenibile. In SQL sarebbe accoppiata alla query, e duplicata tra lista e dettaglio. |
| 5 | **`GROUP_CONCAT` in SQL** per aggregare author_ids e genre_ids nella lista | N+1 query (una per ogni libro per recuperare le relazioni) | N+1 è un anti-pattern classico. Con `GROUP_CONCAT` si fa una sola query; il parsing della stringa CSV in JS è banale. |
| 6 | **Verifica esistenza FK prima della transazione** (publisherExists, authorsExist, genresExist) | Affidarsi al SQLITE_CONSTRAINT_FOREIGNKEY dentro la transazione | SQLite restituisce un errore generico per FK violation che non identifica il campo invalido. La pre-verifica permette di costruire `details` accurati nella risposta VALIDATION_ERROR. |
| 7 | **`updated_at` aggiornato manualmente nel query helper** | Trigger SQLite `AFTER UPDATE` | I trigger in SQLite non sono portabili e complicano il test in isolamento. La responsabilità è esplicita nel codice JS. |
| 8 | **Rate limiter in-memory (Map)**, senza dipendenza esterna | Redis + `express-rate-limit` | Uso interno, singolo processo, pochi client. Redis è over-engineering per i requisiti attuali. Documentata come limitazione: non funziona se l'API scala su più processi. |
| 9 | **Hard delete per i libri con CASCADE** sulle tabelle ponte | Soft delete con campo `deleted_at` | Requisito esplicito della spec. Il CASCADE su `book_authors` e `book_genres` garantisce consistenza automatica. |
| 10 | **Endpoint genres con `router.all('*', 405)`** invece di montare solo GET | Non registrare gli altri metodi (Express restituirebbe 404) | 405 è semanticamente corretto: la risorsa esiste, il metodo non è permesso. 404 sarebbe fuorviante per il client. |
| 11 | **Colonne `sort` validate da Joi** con `Joi.string().valid(...)` prima di interpolarle nella query SQL | Whitelist nel db layer | Doppia difesa. Joi è il punto canonico di validazione dell'input; il db layer non deve ripetere questa logica. La whitelist Joi impedisce SQL injection anche se l'interpolazione è nell'ORDER BY. |
| 12 | **`PRAGMA journal_mode = WAL`** abilitato alla connessione | Default journal mode (DELETE) | WAL permette letture concorrenti durante una scrittura e migliora le performance generali. Nessun costo per uso single-process. |

---

## Appendice: flusso completo PATCH /books/:id

Il PATCH è l'operazione più complessa per la gestione delle relazioni. Il flusso completo:

```
1. auth middleware → verifica API Key
2. rateLimiter middleware → verifica e aggiorna contatore
3. route handler:
   a. Valida :id (numerico positivo) — se non valido: 400 VALIDATION_ERROR
   b. Valida req.body con updateBook schema — se invalido: 400 VALIDATION_ERROR
   c. Se body vuoto {}: recupera libro esistente, restituisce 200 invariato
   d. Se publisher_id nel body: verifica esistenza → 400 se non trovato
   e. Se author_ids nel body: verifica esistenza di tutti → 400 con missing ids
   f. Se genre_ids nel body: verifica esistenza di tutti → 400 con missing ids
   g. Chiama db/books.updateBook(id, value) in transazione:
      - UPDATE books SET ... WHERE id = ? (solo i campi presenti)
      - Se isbn duplicato: lancia { code: DUPLICATE_ISBN, status: 409 }
      - Se author_ids presente: DELETE FROM book_authors WHERE book_id = ?
                                + INSERT INTO book_authors per ogni nuovo id
      - Se genre_ids presente: DELETE FROM book_genres WHERE book_id = ?
                                + INSERT INTO book_genres per ogni nuovo id
      - Restituisce null se il libro non esiste (changes === 0)
   h. Se null: 404 NOT_FOUND
   i. Legge libro aggiornato, aggiunge low_stock, risponde 200 { data: book }
```
