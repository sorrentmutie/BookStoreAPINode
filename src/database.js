'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'bookstore.db');

const db = new Database(DB_PATH);

// Pragmas obbligatori
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

db.exec(`
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
    birth_date   TEXT,
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
    price             REAL    NOT NULL CHECK (price > 0),
    quantity          INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    publication_year  INTEGER,
    description       TEXT,
    publisher_id      INTEGER REFERENCES publishers(id),
    author            TEXT,
    category          TEXT,
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

  CREATE INDEX IF NOT EXISTS idx_books_title            ON books(title);
  CREATE INDEX IF NOT EXISTS idx_books_publisher_id     ON books(publisher_id);
  CREATE INDEX IF NOT EXISTS idx_book_authors_author_id ON book_authors(author_id);
  CREATE INDEX IF NOT EXISTS idx_book_genres_genre_id   ON book_genres(genre_id);
`);

// ---------------------------------------------------------------------------
// Seed (idempotente — usa INSERT OR IGNORE)
// ---------------------------------------------------------------------------

const seedGenres = db.transaction(() => {
  const genres = [
    'Fiction', 'Non-Fiction', 'Sci-Fi', 'Fantasy', 'Romance',
    'Thriller', 'Horror', 'Biography', 'History', 'Science', 'Children'
  ];
  const insert = db.prepare('INSERT OR IGNORE INTO genres (name) VALUES (?)');
  for (const name of genres) insert.run(name);
});

const seedApiKeys = db.transaction(() => {
  db.prepare(
    'INSERT OR IGNORE INTO api_keys (key, client_name) VALUES (?, ?)'
  ).run('dev-key-1234', 'development-client');
});

seedGenres();
seedApiKeys();


module.exports = db;
