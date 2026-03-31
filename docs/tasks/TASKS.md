# Task List - BookStore API

**Versione**: 1.0
**Data**: 2026-03-31
**Stack**: Node.js, Express 5, SQLite via better-sqlite3 (sincrono), Joi, Jest + Supertest

---

## Stato del progetto

La struttura di file esiste gia integralmente sotto `src/`. Tutti i moduli sono stati
creati con le firme di funzione e i commenti JSDoc corretti, ma i corpi delle funzioni
contengono solo `// TODO`. I test in `tests/integration/` sono tutti `test.todo`.

I file gia completamente implementati (nessuna azione necessaria):
- `src/app.js` — Express app, middleware pipeline, router montati
- `src/server.js` — entry point HTTP
- `src/database.js` — connessione SQLite, schema DDL completo, seed generi e API key
- `src/middleware/auth.js` — middleware autenticazione X-API-Key
- `src/middleware/rateLimiter.js` — fixed window in-memory rate limiter
- `src/middleware/errorHandler.js` — global error handler JSON
- `src/validators/common.js` — validateId, validatePagination
- `src/validators/books.js` — validateCreateBook, validateUpdateBook, validateListQuery
- `tests/setup.js` — globalSetup Jest (DB_PATH=:memory:, TEST_API_KEY)

---

## Fase 1: Repository Layer (db helpers)

### T001 — Implementare `repositories/apiKeys.js`: `findByKey`

**Descrizione**: Implementare la funzione `findByKey(key)` che esegue una query
`SELECT` sulla tabella `api_keys` e restituisce il record se trovato, `null` altrimenti.
Il modulo importa il singleton `db` da `../database`.

**File da modificare**: `src/repositories/apiKeys.js`

**Dipendenze**: nessuna (database.js e lo schema sono gia pronti)

**Priorita**: alta

**Criterio di successo**:
```
npx jest tests/integration/genres.test.js
```
I test di genres devono passare (usano auth che dipende da findByKey).
In alternativa, verifica manuale: `node -e "require('./src/repositories/apiKeys').findByKey('dev-key-1234')"` ritorna un oggetto con `id`, `key`, `client_name`.

**Stima**: 10 min

---

### T002 — Implementare `repositories/genres.js`: `listAll` e `findById`

**Descrizione**: Implementare le due funzioni del repository generi.
- `listAll()`: `SELECT * FROM genres ORDER BY id` — restituisce array di tutti i generi (11 record dal seed).
- `findById(id)`: `SELECT * FROM genres WHERE id = ?` — restituisce il genere o `null`.
Nessuna paginazione richiesta per i generi.

**File da modificare**: `src/repositories/genres.js`

**Dipendenze**: T001 (il DB deve essere raggiungibile; in pratica solo database.js)

**Priorita**: alta

**Criterio di successo**:
```
npx jest tests/integration/genres.test.js
```
I test genres che verificano la lista e il dettaglio devono passare (una volta implementati in T010).

**Stima**: 10 min

---

### T003 — Implementare `repositories/publishers.js`: CRUD completo

**Descrizione**: Implementare tutte le funzioni per la risorsa publishers:
- `create({ name })`: INSERT, aggiorna `updated_at`, restituisce il record creato.
- `list({ page, limit })`: SELECT paginata, restituisce `{ rows, total }`.
- `findById(id)`: SELECT by id, restituisce oggetto o `null`.
- `update(id, { name })`: UPDATE con `updated_at = strftime(...)`, restituisce record aggiornato o `null`.
- `remove(id)`: verifica prima se esistono libri associati con `SELECT COUNT(*) FROM books WHERE publisher_id = ?`; se ci sono, lancia `{ code: 'HAS_DEPENDENCIES', status: 409 }`; altrimenti esegue DELETE e restituisce `true`/`false`.

**File da modificare**: `src/repositories/publishers.js`

**Dipendenze**: nessuna oltre a database.js

**Priorita**: alta

**Criterio di successo**:
```
npx jest tests/integration/publishers.test.js
```
I test che verificano 201, 200, 404, 204, 409 HAS_DEPENDENCIES devono passare (una volta implementati in T011).

**Stima**: 20 min

---

### T004 — Implementare `repositories/authors.js`: CRUD completo

**Descrizione**: Implementare tutte le funzioni per la risorsa authors:
- `create(data)`: INSERT con tutti i campi (inclusi opzionali nullable), restituisce il record creato.
- `list({ page, limit })`: SELECT paginata, restituisce `{ rows, total }`.
- `findById(id)`: restituisce oggetto o `null`.
- `update(id, data)`: aggiornamento parziale (solo i campi presenti in `data`), aggiorna `updated_at`, restituisce record aggiornato o `null`.
- `remove(id)`: verifica `SELECT COUNT(*) FROM book_authors WHERE author_id = ?`; se ha dipendenze, lancia `{ code: 'HAS_DEPENDENCIES', status: 409 }`; altrimenti DELETE.

**File da modificare**: `src/repositories/authors.js`

**Dipendenze**: nessuna oltre a database.js

**Priorita**: alta

**Criterio di successo**:
```
npx jest tests/integration/authors.test.js
```
I test 201, 200, 404, 204, 409 HAS_DEPENDENCIES devono passare.

**Stima**: 20 min

---

### T005 — Implementare `repositories/books.js`: `findById` con eager loading

**Descrizione**: Implementare `findById(id)` che restituisce un libro completo con
oggetti annidati `publisher` (tutti i campi), `authors` (array di oggetti author),
`genres` (array di oggetti genre). Usare query separate (o JOIN) per recuperare
le relazioni. Restituisce `null` se il libro non esiste.
Il campo `low_stock` NON viene aggiunto qui — e responsabilita del controller.

**File da modificare**: `src/repositories/books.js`

**Dipendenze**: database.js (schema con FK gia creato)

**Priorita**: alta

**Criterio di successo**:
```
node -e "
  process.env.DB_PATH = ':memory:';
  const repo = require('./src/repositories/books');
  console.log(repo.findById(999));  // deve stampare null
"
```
Nessun errore a runtime; restituisce `null` per id inesistente.

**Stima**: 20 min

---

### T006 — Implementare `repositories/books.js`: `list` con filtri, paginazione, ordinamento

**Descrizione**: Implementare `list(filters)` che costruisce dinamicamente la query
SELECT con:
- Filtri opzionali: `title` (LIKE case-insensitive), `author_id` (INNER JOIN book_authors),
  `genre_id` (INNER JOIN book_genres), `publisher_id` (WHERE).
- `GROUP_CONCAT(DISTINCT ba.author_id)` e `GROUP_CONCAT(DISTINCT bg.genre_id)` per
  aggregare le relazioni come stringhe CSV da parsare in array di interi.
- ORDER BY su colonne whitelist: `b.title`, `b.price`, `b.publication_year`.
- LIMIT/OFFSET per paginazione.
- Query COUNT separata per `total`.
Restituisce `{ rows: [...], total: number }`.

**File da modificare**: `src/repositories/books.js`

**Dipendenze**: T005 (stesso file, stessa istanza db)

**Priorita**: alta

**Criterio di successo**:
```
node -e "
  process.env.DB_PATH = ':memory:';
  const repo = require('./src/repositories/books');
  const r = repo.list({ page: 1, limit: 20, sort: 'title', order: 'asc' });
  console.log(r.rows, r.total);  // array vuoto e 0 su DB fresco
"
```
Nessun errore; `rows` e un array, `total` e un numero.

**Stima**: 25 min

---

### T007 — Implementare `repositories/books.js`: `create` in transazione

**Descrizione**: Implementare `create(data)` usando `db.transaction(...)`.
La transazione deve:
1. Prima delle query di inserimento, verificare che `publisher_id` esista (SELECT COUNT),
   che tutti gli `author_ids` esistano (SELECT id FROM authors WHERE id IN (...)),
   che tutti i `genre_ids` esistano (SELECT id FROM genres WHERE id IN (...)).
   In caso di FK mancante, lanciare `{ code: 'VALIDATION_ERROR', status: 400, details: [{field, message}] }`.
2. INSERT INTO books con tutti i campi scalari.
3. Intercettare `SqliteError` con `code === 'SQLITE_CONSTRAINT_UNIQUE'` e rilanciare
   `{ code: 'DUPLICATE_ISBN', status: 409 }`.
4. INSERT INTO book_authors per ogni author_id.
5. INSERT INTO book_genres per ogni genre_id.
6. Chiamare `findById(newId)` per restituire il record completo.

**File da modificare**: `src/repositories/books.js`

**Dipendenze**: T005 (findById usato al passo 6)

**Priorita**: alta

**Criterio di successo**:
```
npx jest tests/integration/books.test.js --testNamePattern="crea un libro"
```
Il test di creazione con payload valido deve restituire 201 con il libro completo.

**Stima**: 25 min

---

### T008 — Implementare `repositories/books.js`: `update` e `remove`

**Descrizione**: Implementare le ultime due funzioni del repository books:

`update(id, data)`:
- Costruisce dinamicamente la clausola SET con solo i campi presenti in `data`.
- Se `author_ids` presenti: DELETE FROM book_authors WHERE book_id = ?, poi INSERT.
- Se `genre_ids` presenti: DELETE FROM book_genres WHERE book_id = ?, poi INSERT.
- Verifica FK (publisher_id, author_ids, genre_ids) prima dell'UPDATE se presenti.
- Aggiorna `updated_at` manualmente.
- Intercetta `SQLITE_CONSTRAINT_UNIQUE` per ISBN duplicato.
- Restituisce il record aggiornato via `findById` o `null` se non trovato.
- Se `data` non contiene campi scalari (solo relazioni o body vuoto), non eseguire UPDATE SQL.

`remove(id)`:
- DELETE FROM books WHERE id = ? (CASCADE elimina automaticamente book_authors e book_genres).
- Restituisce `true` se `changes > 0`, `false` altrimenti.

**File da modificare**: `src/repositories/books.js`

**Dipendenze**: T005, T007

**Priorita**: alta

**Criterio di successo**:
```
npx jest tests/integration/books.test.js
```
I test PATCH e DELETE devono passare (una volta implementati in T013).

**Stima**: 25 min

---

## Fase 2: Validators aggiuntivi

### T009 — Implementare `validators/authors.js` e `validators/publishers.js`

**Descrizione**: I file esistono ma potrebbero essere stub. Verificare e completare:

`validators/authors.js` deve esportare:
- `validateCreateAuthor(body)`: schema Joi con `first_name` (required), `last_name` (required), `birth_date` (isoDate, optional, nullable), `biography` (optional, nullable), `nationality` (optional, nullable). Lancia errore applicativo se invalido.
- `validateUpdateAuthor(body)`: stessi campi tutti opzionali, `min(0)`.

`validators/publishers.js` deve esportare:
- `validateCreatePublisher(body)`: schema Joi con `name` (required, min(1)).
- `validateUpdatePublisher(body)`: `name` required (`min(1)`, unico campo dell'editore).

Pattern uguale a books.js: `abortEarly: false`, lancia `{ code: 'VALIDATION_ERROR', status: 400, details }`.

**File da modificare**: `src/validators/authors.js`, `src/validators/publishers.js`

**Dipendenze**: nessuna

**Priorita**: alta

**Criterio di successo**: I controller authors e publishers possono importare e chiamare
le funzioni di validazione senza errore. Verifica:
```
node -e "require('./src/validators/authors').validateCreateAuthor({ first_name: 'Mario', last_name: 'Rossi' })"
```
Nessun errore.

**Stima**: 15 min

---

## Fase 3: Controller Layer

### T010 — Implementare `controllers/genres.js`

**Descrizione**: Implementare i controller per la risorsa genres (sola lettura):
- `list(req, res, next)`: chiama `genresRepository.listAll()`, risponde `200` con `{ data: [...] }` (no `meta`, lista completa).
- `getById(req, res, next)`: valida `req.params.id` via `validateId`, chiama `findById`, risponde `200` con `{ data: genre }` oppure propaga `{ code: 'NOT_FOUND', status: 404 }`.

Il router `routes/genres.js` deve anche rispondere `405` a POST/PATCH/DELETE con `router.all('*', ...)`.

**File da modificare**: `src/controllers/genres.js`, eventualmente `src/routes/genres.js`

**Dipendenze**: T002, T009

**Priorita**: alta

**Criterio di successo**:
```
npx jest tests/integration/genres.test.js
```
Tutti i test genres (lista, dettaglio, 404, 405) devono passare.

**Stima**: 15 min

---

### T011 — Implementare `controllers/publishers.js`

**Descrizione**: Implementare i 5 controller per publishers:
- `create`: validateCreatePublisher → repository.create → `201 { data }`.
- `list`: validatePagination → repository.list → `200 { data: rows, meta: { page, limit, total } }`.
- `getById`: validateId → repository.findById → `200 { data }` oppure `404 NOT_FOUND`.
- `update`: validateId + validateUpdatePublisher → repository.update → `200 { data }` oppure `404`.
- `remove`: validateId → repository.remove (che lancia 409 se ha dipendenze) → `204`.

Tutti i metodi usano try/catch per propagare errori via `next(err)`.

**File da modificare**: `src/controllers/publishers.js`

**Dipendenze**: T003, T009

**Priorita**: alta

**Criterio di successo**:
```
npx jest tests/integration/publishers.test.js
```
Tutti i test publishers devono passare.

**Stima**: 20 min

---

### T012 — Implementare `controllers/authors.js`

**Descrizione**: Implementare i 5 controller per authors:
- `create`: validateCreateAuthor → repository.create → `201 { data }`.
- `list`: validatePagination → repository.list → `200 { data: rows, meta }`.
- `getById`: validateId → repository.findById → `200 { data }` oppure `404`.
- `update`: validateId + validateUpdateAuthor → repository.update → `200 { data }` oppure `404`.
- `remove`: validateId → repository.remove (che lancia 409 HAS_DEPENDENCIES) → `204`.

Tutti tramite try/catch e `next(err)`.

**File da modificare**: `src/controllers/authors.js`

**Dipendenze**: T004, T009

**Priorita**: alta

**Criterio di successo**:
```
npx jest tests/integration/authors.test.js
```
Tutti i test authors devono passare.

**Stima**: 20 min

---

### T013 — Implementare `controllers/books.js`: `create` e `list`

**Descrizione**: Implementare i primi due controller books:

`create(req, res, next)`:
1. `try { const data = validateCreateBook(req.body) } catch(e) { return next(e) }`.
2. `const book = booksRepository.create(data)` (wrappato in try/catch per propagare DUPLICATE_ISBN, VALIDATION_ERROR FK).
3. `res.status(201).json({ data: addLowStock(book) })`.

`list(req, res, next)`:
1. Valida query params con `validateListQuery`.
2. Chiama `booksRepository.list(filters)`.
3. Aggiunge `low_stock` a ogni libro: `rows.map(addLowStock)`.
4. Risponde `200` con `{ data: books, meta: { page, limit, total } }`.

La funzione `addLowStock` e gia definita nel file: `return { ...book, low_stock: book.quantity <= 5 }`.

**File da modificare**: `src/controllers/books.js`

**Dipendenze**: T006, T007

**Priorita**: alta

**Criterio di successo**:
```
npx jest tests/integration/books.test.js --testNamePattern="POST|GET /api/v1/books$"
```
I test di creazione e lista devono passare.

**Stima**: 20 min

---

### T014 — Implementare `controllers/books.js`: `getById`, `update`, `remove`

**Descrizione**: Implementare i restanti tre controller books:

`getById(req, res, next)`:
- validateId → repository.findById → `200 { data: addLowStock(book) }` oppure `404`.

`update(req, res, next)`:
- validateId + validateUpdateBook → repository.update (che gestisce DUPLICATE_ISBN, FK, body vuoto) → `200 { data: addLowStock(book) }` oppure `404`.

`remove(req, res, next)`:
- validateId → repository.remove → `204` senza body oppure `404`.

**File da modificare**: `src/controllers/books.js`

**Dipendenze**: T005, T008, T013

**Priorita**: alta

**Criterio di successo**:
```
npx jest tests/integration/books.test.js
```
Tutti i test books devono passare (inclusi quelli di T013).

**Stima**: 20 min

---

## Fase 4: Test di integrazione

### T015 — Implementare `tests/integration/genres.test.js`

**Descrizione**: Sostituire i `test.todo` con test reali usando Supertest. Coprire:
- `GET /api/v1/genres` → `200`, `data` e un array con 11 elementi, contiene "Fiction".
- `GET /api/v1/genres/:id` con id valido → `200`, `{ data: { id, name } }`.
- `GET /api/v1/genres/99999` → `404 NOT_FOUND`.
- `GET /api/v1/genres/abc` → `400 VALIDATION_ERROR`.
- `POST /api/v1/genres` → `405 METHOD_NOT_ALLOWED`.
- `PATCH /api/v1/genres/1` → `405`.
- `DELETE /api/v1/genres/1` → `405`.

Ogni test deve includere l'header `X-API-Key: dev-key-1234`.

**File da modificare**: `tests/integration/genres.test.js`

**Dipendenze**: T010

**Priorita**: media

**Criterio di successo**:
```
npx jest tests/integration/genres.test.js
```
0 test falliti, 0 `todo`.

**Stima**: 20 min

---

### T016 — Implementare `tests/integration/publishers.test.js`

**Descrizione**: Sostituire i `test.todo` con test reali. Coprire:
- `POST /api/v1/publishers` con `{ name: "Bompiani" }` → `201`, id generato.
- `POST /api/v1/publishers` senza `name` → `400 VALIDATION_ERROR`.
- `GET /api/v1/publishers` → `200`, envelope con `meta`.
- `GET /api/v1/publishers/:id` → `200` per id esistente, `404` per id inesistente.
- `PATCH /api/v1/publishers/:id` con `{ name: "Nuovo" }` → `200`, name aggiornato.
- `DELETE /api/v1/publishers/:id` senza libri → `204`.
- `DELETE /api/v1/publishers/:id` con libri → `409 HAS_DEPENDENCIES`.

Usare `beforeEach` o `beforeAll` per creare fixture con `POST /api/v1/publishers`.

**File da modificare**: `tests/integration/publishers.test.js`

**Dipendenze**: T011

**Priorita**: media

**Criterio di successo**:
```
npx jest tests/integration/publishers.test.js
```
0 test falliti.

**Stima**: 25 min

---

### T017 — Implementare `tests/integration/authors.test.js`

**Descrizione**: Sostituire i `test.todo` con test reali. Coprire:
- `POST /api/v1/authors` con `{ first_name, last_name }` → `201`.
- `POST` senza `first_name` → `400 VALIDATION_ERROR`.
- `POST` senza `last_name` → `400 VALIDATION_ERROR`.
- `GET /api/v1/authors` → `200`, meta presente.
- `GET /api/v1/authors/:id` esistente → `200`.
- `GET /api/v1/authors/99999` → `404 NOT_FOUND`.
- `PATCH /api/v1/authors/:id` parziale (es. solo `biography`) → `200`, campo aggiornato.
- `DELETE` autore senza libri → `204`.
- `DELETE` autore con libri → `409 HAS_DEPENDENCIES` (richede prima di creare un libro associato).
- `DELETE` id inesistente → `404`.

**File da modificare**: `tests/integration/authors.test.js`

**Dipendenze**: T012

**Priorita**: media

**Criterio di successo**:
```
npx jest tests/integration/authors.test.js
```
0 test falliti.

**Stima**: 25 min

---

### T018 — Implementare `tests/integration/books.test.js`

**Descrizione**: Sostituire i `test.todo` con test reali. Questa e la suite piu complessa.
Usare `beforeAll` per creare un publisher e un author da riutilizzare nei test.

Scenari da coprire per `POST /api/v1/books`:
- Payload valido → `201`, `low_stock` presente, id generato.
- ISBN duplicato → `409 DUPLICATE_ISBN`.
- ISBN formato non valido → `400 VALIDATION_ERROR`, `details[].field === 'isbn'`.
- Campi obbligatori mancanti → `400 VALIDATION_ERROR`.
- `publisher_id` inesistente → `400 VALIDATION_ERROR`.
- `author_ids` con id inesistente → `400 VALIDATION_ERROR`.
- `price: 0` → `201`.
- `price: -1` → `400`.
- `quantity: -1` → `400`.
- `quantity: 5` → `201`, `low_stock: true`.

Scenari per `GET /api/v1/books`:
- Lista con meta `{ page: 1, limit: 20, total }`.
- Filtro `?title=` (case-insensitive).
- Filtro `?author_id=`, `?genre_id=`, `?publisher_id=`.
- `?sort=price&order=asc`.
- `?sort=isbn` → `400`.
- `?limit=200` → `400`.
- `?page=abc` → `400`.
- `low_stock` presente su ogni elemento.

Scenari per `GET /api/v1/books/:id`:
- Dettaglio con `publisher` oggetto, `authors` array, `genres` array.
- `404` per id inesistente.
- `400` per id non numerico.

Scenari per `PATCH /api/v1/books/:id`:
- Aggiornamento parziale (solo `price`).
- `quantity: 3` → `low_stock: true`.
- `quantity: 10` → `low_stock: false`.
- `quantity: -1` → `400`.
- ISBN duplicato → `409`.
- Sostituzione `author_ids`.
- Body `{}` → `200`, dati invariati.
- `404` per id inesistente.

Scenari per `DELETE /api/v1/books/:id`:
- `204` per id esistente; GET successiva → `404`.
- `404` per id inesistente.

**File da modificare**: `tests/integration/books.test.js`

**Dipendenze**: T013, T014

**Priorita**: media

**Criterio di successo**:
```
npx jest tests/integration/books.test.js
```
0 test falliti.

**Stima**: 40 min

---

## Fase 5: Test autenticazione e rate limiting

### T019 — Aggiungere test per autenticazione API Key

**Descrizione**: Aggiungere un file `tests/integration/auth.test.js` che verifica
il middleware di autenticazione trasversalmente:
- Richiesta senza header `X-API-Key` → `401 MISSING_API_KEY`.
- Richiesta con API key errata → `401 INVALID_API_KEY`.
- Header `X-API-Key` con stringa vuota → `401`.
- Richiesta autenticata correttamente → risposta normale (es. `GET /api/v1/genres` → `200`).
- Verifica che il middleware si applichi a tutti gli endpoint (GET, POST, PATCH, DELETE).

**File da creare**: `tests/integration/auth.test.js`

**Dipendenze**: T010 (almeno un endpoint funzionante per testare il passthrough)

**Priorita**: media

**Criterio di successo**:
```
npx jest tests/integration/auth.test.js
```
Tutti i test passano.

**Stima**: 15 min

---

### T020 — Aggiungere test per rate limiter

**Descrizione**: Aggiungere test `tests/integration/rateLimiter.test.js` per verificare:
- Gli header `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` sono presenti
  in ogni risposta autenticata.
- Dopo 100 richieste nella stessa finestra, la 101° risponde `429 RATE_LIMIT_EXCEEDED`
  con header `Retry-After`.

Nota: per testare il limite senza fare 100 richieste reali, si puo mockare `Date.now`
oppure manipolare il modulo `store` esportato, oppure fare un loop di 101 richieste
(con DB in-memory e no I/O e veloce).

**File da creare**: `tests/integration/rateLimiter.test.js`

**Dipendenze**: T010

**Priorita**: bassa

**Criterio di successo**:
```
npx jest tests/integration/rateLimiter.test.js
```
Tutti i test passano.

**Stima**: 20 min

---

## Fase 6: Verifica finale

### T021 — Eseguire la suite completa e verificare la copertura

**Descrizione**: Eseguire tutti i test con coverage e verificare che:
- 0 test falliti.
- Copertura di branch >= 80% per i file in `src/repositories/` e `src/controllers/`.
- Nessun `test.todo` rimasto nella suite.

**Dipendenze**: T015, T016, T017, T018, T019

**Priorita**: bassa

**Criterio di successo**:
```
npx jest --coverage --runInBand
```
Output: `Test Suites: N passed`, `Tests: N passed`, `0 failed`, coverage report generato.

**Stima**: 10 min

---

## Mappa delle dipendenze

```
T001 (apiKeys.findByKey)
  └─ usato da: middleware/auth.js (gia implementato)

T002 (genres repo)      ──> T010 (genres controller) ──> T015 (genres test)
T003 (publishers repo)  ──> T011 (publishers ctrl)   ──> T016 (publishers test)
T004 (authors repo)     ──> T012 (authors ctrl)       ──> T017 (authors test)
T009 (validators)       ──> T010, T011, T012

T005 (books.findById)
T006 (books.list)       ──> T013 (books ctrl create+list)
T007 (books.create)     ──> T013
T008 (books.update+rm)  ──> T014 (books ctrl getById+update+rm)  ──> T018 (books test)
T013                    ──> T014

T010 ──> T019 (auth test)
T010 ──> T020 (rate limiter test)

T015+T016+T017+T018+T019 ──> T021 (full coverage run)
```

---

## Riepilogo per priorita

| Priorita | Task |
|----------|------|
| Alta     | T001, T002, T003, T004, T005, T006, T007, T008, T009, T010, T011, T012, T013, T014 |
| Media    | T015, T016, T017, T018, T019 |
| Bassa    | T020, T021 |
