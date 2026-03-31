# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Runtime**: Node.js
- **Framework**: Express 5
- **Database**: SQLite via `better-sqlite3` (synchronous API — no async/await needed for DB calls)
- **Validation**: Joi
- **Testing**: Jest + Supertest
- **Dev server**: nodemon

## Commands

```bash
# Start dev server (auto-reload)
npm run dev

# Start production server
npm start

# Run all tests
npm test

# Run a single test file
npx jest path/to/file.test.js

# Run tests with coverage
npx jest --coverage
```

## Architecture

```
src/
├── server.js          # Entry point (loads dotenv, starts Express)
├── app.js             # Middleware pipeline + route mounting
├── database.js        # SQLite init, schema creation, seed
├── controllers/       # HTTP layer: validate input, call repository, send response
├── repositories/      # Data layer: SQL queries only, no HTTP concerns
├── routes/            # Express Router definitions
├── validators/        # Joi schemas + validation functions
└── middleware/
    ├── auth.js        # X-API-Key header validation
    ├── rateLimiter.js # 100 req/min per API key (fixed window, in-memory)
    └── errorHandler.js# Global error handler → { error: { code, message, details? } }
```

### Middleware pipeline order

```
express.json() → auth → rateLimiter → routes → 404 → errorHandler
```

## Key conventions

### Database (CRITICAL)
- `better-sqlite3` is **synchronous** — do not use `async/await` or Promises for DB calls.
- Use `db.prepare(sql).get(params)` for single row, `.all(params)` for multiple, `.run(params)` for writes.
- Multi-table writes (e.g. book + book_authors + book_genres) **must** use `db.transaction()`.
- Spread params: `db.prepare(sql).get(...paramsArray)` — not `.get(paramsArray)`.

### Error format
All errors thrown in controllers/repositories must follow this shape:
```js
throw { code: 'ERROR_CODE', status: 404, message: 'Human readable message' }
// With field details (validation):
throw { code: 'VALIDATION_ERROR', status: 400, message: '...', details: [{ field, message }] }
```
The global `errorHandler` converts these to `{ error: { code, message, details? } }`.

### Response envelope
```js
// Single resource
res.json({ data: item })
// List + pagination
res.json({ data: items, meta: { page, limit, total } })
// Create
res.status(201).json({ data: item })
// Delete
res.status(204).send()
```

### Validation
- Use `Joi` for all request body and query param validation.
- Always use `{ abortEarly: false }` to collect all errors at once.
- Map `error.details` to `{ field: d.path.join('.'), message: d.message }`.
- Use `validateId` from `validators/common.js` for `:id` params.
- Use `validatePagination` from `validators/common.js` for `page`/`limit` query params.

### SQL injection prevention
- Always use parameterized queries (`?` placeholders). Never concatenate user input into SQL.
- For ORDER BY, use a whitelist object (see `SORT_COLUMNS` in `repositories/books.js`).
- For LIKE, escape special chars: `value.replace(/[%_\\]/g, '\\$&')` and append `ESCAPE '\\'`.

### Repository pattern for conflict checks
```js
// Check before delete (preferred over catching FK constraint errors)
const { count } = db.prepare('SELECT COUNT(*) AS count FROM book_authors WHERE author_id = ?').get(id);
if (count > 0) return { conflict: true };
// Controller interprets: if (result.conflict) return next({ code: 'AUTHOR_HAS_BOOKS', status: 409 })
```

### Computed fields
- `low_stock: boolean` — added in the books controller via `addLowStock(book)`, not stored in DB.
- `book_count: number` — computed in publisher/genre repositories via `COUNT(*)`.

## Database schema

```sql
publishers  (id PK, name, created_at, updated_at)
authors     (id PK, first_name, last_name, birth_date, biography, nationality, created_at, updated_at)
genres      (id PK, name UNIQUE)          -- pre-seeded, read-only via API
books       (id PK, title, isbn UNIQUE, price CHECK(>0), quantity DEFAULT 0 CHECK(>=0),
             publication_year, description, publisher_id FK→publishers, author, category,
             created_at, updated_at)
book_authors (book_id FK CASCADE, author_id FK RESTRICT)  -- many-to-many
book_genres  (book_id FK CASCADE, genre_id FK RESTRICT)   -- many-to-many
api_keys    (id PK, key UNIQUE, client_name, created_at)
```

**Important**: `CREATE TABLE IF NOT EXISTS` does NOT alter existing tables. If the schema changes, either:
1. Delete `bookstore.db` and restart (dev only, loses all data), or
2. Run `ALTER TABLE ... ADD COLUMN` manually.

## Authentication

All endpoints require `X-API-Key` header. Dev key: `dev-key-1234` (seeded automatically).

## Testing

- Tests use SQLite in-memory DB (`DB_PATH=:memory:` set in `tests/setup.js`).
- Tests run serially (`--runInBand`) to avoid race conditions on the shared in-memory DB.
- Each test file must clean up its tables in `afterEach` to prevent test pollution:
  ```js
  afterEach(() => {
    db.prepare('DELETE FROM book_authors').run();
    db.prepare('DELETE FROM books').run();
    db.prepare('DELETE FROM authors').run();
  });
  ```
- Delete in dependency order (junction tables first, then dependent, then parent).
- Genres and api_keys are seeded once and should NOT be deleted between tests.

## Files to reference when adding new endpoints

When implementing a new resource, read these files first:
1. `src/repositories/books.js` — patterns for list with search/pagination, transactions
2. `src/controllers/books.js` — try/catch → next(e) pattern, response shapes
3. `src/validators/books.js` — Joi schema + validation function pattern
4. `src/validators/common.js` — reuse `validateId` and `validatePagination`
5. `tests/integration/authors.test.js` — test structure with `beforeEach`/`afterEach`

## Lessons learned

### On DB schema evolution
`CREATE TABLE IF NOT EXISTS` skips creation if the table exists — it does **not** apply new columns. If you add columns to the schema in `database.js`, existing `bookstore.db` files are unaffected. Use `ALTER TABLE ... ADD COLUMN` or delete the DB.

### On agents and background tasks
Background agents cannot get interactive tool permission approvals. If running sub-agents in background mode, either run them in foreground (so the user can approve tool calls interactively) or implement the code directly in the main conversation.

### On duplicate checks without UNIQUE constraints
If a DB column lacks a `UNIQUE` constraint (e.g. `publishers.name`), SQLite won't throw `SQLITE_CONSTRAINT_UNIQUE`. Do the duplicate check explicitly with a `SELECT` before `INSERT`.

### On test cleanup order
SQLite foreign key constraints (`ON DELETE RESTRICT`) mean you must delete child records before parent records. Wrong order silently fails or errors depending on FK pragma state.

### On dotenv
`dotenv` must be installed explicitly (`npm install dotenv`) even if it's only used in `server.js`. It is not included in the base Express setup.
