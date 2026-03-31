# Code Review Report — BookStore API

**Reviewer**: Claude (Automated Code Review Agent)  
**Date**: 2026-03-31  
**Branch**: `develop`  
**Scope**: Books resource implementation (controllers, repositories, validators, middleware, routes, tests)

---

## Summary

The Books resource is the first fully implemented vertical slice of the BookStore API. The code demonstrates a solid layered architecture with proper separation of concerns. The review identifies deviations from the spec, missing fields, and patterns to follow for the remaining Authors, Publishers, and Genres endpoints.

---

## 1. Critical Issues (Must Fix Before Production)

### C-01: Price Constraint Mismatch — SPEC Allows price=0, Code Rejects It

**Files**:
- `src/validators/books.js` line 25: `Joi.number().greater(0)`
- `src/database.js` line 46: `CHECK (price > 0)`

**Problem**: The SPEC explicitly states `price >= 0` and that price=0 should be accepted for complimentary books ("libri omaggio").

**How to fix**: Change Joi to `Joi.number().min(0).required()` and the DB constraint to `CHECK (price >= 0)`.

---

### C-02: Create Does Not Use a Transaction

**File**: `src/repositories/books.js` lines 160–178

**Problem**: `create()` performs a plain INSERT without `db.transaction()`. When the full model (author_ids, genre_ids) is added, a failure midway would leave the DB inconsistent.

**How to fix**: Wrap INSERT + relation inserts in `db.transaction()` as done in `update()`.

---

### C-03: Update Validator Missing Fields

**File**: `src/validators/books.js` lines 31–40

**Problem**: `updateBookSchema` declares only `title`, `isbn`, `author`, `price`, `category` with `stripUnknown: true`. Fields like `quantity` and `publisher_id` are in `SCALAR_FIELDS` of the repository but are stripped before reaching it — PATCH with `{ "quantity": 10 }` does nothing.

**How to fix**: Add `quantity`, `publication_year`, `description`, `publisher_id`, `author_ids`, `genre_ids` to `updateBookSchema`.

---

## 2. High Priority Issues (Should Fix)

### H-01: Missing express.json() Size Limit

**File**: `src/app.js`

**Suggested fix**: `app.use(express.json({ limit: '16kb' }));`

---

### H-02: Error Handler Does Not Handle Malformed JSON

**File**: `src/middleware/errorHandler.js`

**Problem**: Requests with invalid JSON (`{ invalid json`) will return Express's default format instead of the standard `{ error: { code, message } }` envelope.

**How to fix**: Add check for `err.type === 'entity.parse.failed'` at the top of the error handler.

---

### H-03: API Key Lookup on Every Request Without Caching

**File**: `src/middleware/auth.js` line 19

**Problem**: Every request hits the DB for API key validation. Acceptable for current load but worth noting.

---

## 3. Suggestions (Nice to Have)

### S-01: Repetitive try/catch in Controllers

**File**: `src/controllers/books.js`

Each function has 2–3 try/catch blocks forwarding to `next(e)`. A simple wrapper would reduce boilerplate:

```js
function wrap(fn) {
  return (req, res, next) => { try { fn(req, res, next); } catch (e) { next(e); } };
}
```

---

### S-02: Extract Shared Test Fixtures

**Files**: `tests/integration/*.test.js`, `tests/unit/**/*.test.js`

Helper functions (`insertPublisher`, `insertAuthor`, etc.) are duplicated across test files. Extract to `tests/helpers/fixtures.js`.

---

### S-03: LIKE with Leading Wildcard Cannot Use B-tree Index

**File**: `src/repositories/books.js` line 98

`LIKE '%pattern%'` forces a full table scan regardless of the index on `books.title`. For large datasets, consider SQLite FTS5.

---

## 4. Security Checklist

| Check | Status | Notes |
|---|---|---|
| SQL Injection: parameterized queries | PASS | All queries use `?` placeholders |
| SQL Injection: ORDER BY | PASS | Whitelist + Joi `valid()` double defense |
| SQL Injection: LIKE pattern | PASS | `%`, `_`, `\` are escaped correctly |
| Authentication on all endpoints | PASS | Global `authMiddleware` mount |
| Error message leakage | PASS | Stack traces hidden in production |
| Rate limiting | PASS | Correctly implemented per API key |
| Request size limit | WARN | No explicit `limit` in `express.json()` |

---

## 5. Test Coverage Assessment

**Estimated: ~35–40% of implemented code**

| Area | Status |
|---|---|
| POST /api/v1/books | Covered (12 tests) |
| GET /api/v1/books (list) | Covered (17 + 13 tests) |
| GET /api/v1/books/:id | Not covered |
| PATCH /api/v1/books/:id | Not covered |
| DELETE /api/v1/books/:id | Not covered |
| Auth middleware | Partially (indirect) |
| Rate limiter | Not covered |
| Error handler | Not covered |

---

## 6. What Is Done Well (Patterns to Replicate)

1. **SQL injection prevention**: Parameterized queries throughout; LIKE pattern escaping is correct.
2. **Sort column whitelist**: `SORT_COLUMNS` object + Joi `valid()` is textbook secure ORDER BY.
3. **Consistent error envelope**: `{ error: { code, message, details? } }` everywhere.
4. **`addLowStock` computed field**: Single definition, applied consistently in list and detail.
5. **Idempotent seed**: `INSERT OR IGNORE` is correct.
6. **WAL mode + foreign_keys pragma**: Correct SQLite configuration at startup.
7. **Transaction in `update()`**: FK verification + scalar update + relation replacement in one transaction — replicate this in `create()`.
8. **Rate limiter headers**: `X-RateLimit-*` and `Retry-After` correctly computed and set.

---

## 7. Patterns for Remaining Endpoints (Authors, Publishers, Genres)

1. Use the controller layer (clean separation of HTTP from data concerns).
2. Follow the try/catch → `next(e)` pattern.
3. For DELETE with dependencies: return `{ conflict: true }` from repository, translate to 409 in controller.
4. For genres: route already has 405 catch-all — only `list` and `getById` need controller implementations.
5. For publisher/author name uniqueness: catch `SQLITE_CONSTRAINT_UNIQUE` in repository, throw `{ code: 'DUPLICATE_NAME', status: 409 }`.
