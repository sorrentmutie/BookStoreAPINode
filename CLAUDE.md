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
npx nodemon index.js

# Run all tests
npx jest

# Run a single test file
npx jest path/to/file.test.js

# Run tests with coverage
npx jest --coverage
```

> The `test` script in `package.json` is a placeholder — wire it up when tests are added.

## Architecture intent

This is a REST API for a bookstore. The project is in its initial state (no application code yet). Expected structure:

- `index.js` — app entry point (Express setup, middleware, route mounting)
- `routes/` — Express routers grouped by resource (e.g., `books.js`, `authors.js`)
- `db/` — database initialization, schema, and query helpers using `better-sqlite3`
- `validators/` — Joi schemas for request validation
- `tests/` — Jest + Supertest integration tests

## Key conventions

- `better-sqlite3` is **synchronous** — do not use `async/await` or Promises for DB calls.
- Use `joi` for validating incoming request bodies before touching the database.
- `.env` files and `*.db`/`*.sqlite` files are git-ignored; document any required env vars in README or a `.env.example`.
