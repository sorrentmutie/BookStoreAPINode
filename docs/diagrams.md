# Diagrammi Architetturali — BookStore API

**Versione**: 1.0  
**Data**: 2026-03-31

---

## 1. C4 — Context Diagram

Mostra il sistema nel suo contesto: chi interagisce con esso e da dove.

```mermaid
C4Context
    title BookStore API — System Context

    Person(catalogManager, "Gestore del Catalogo", "Operatore interno che gestisce libri, autori ed editori tramite il frontend")
    Person(sysAdmin, "Amministratore di Sistema", "Gestisce le API Key e monitora l'utilizzo dell'API")

    System(bookstoreAPI, "BookStore API", "REST API per la gestione dell'inventario della libreria. Espone operazioni CRUD su libri, autori, editori e generi.")

    System_Ext(webFrontend, "Web / Mobile Frontend", "Applicazione client sviluppata internamente. Consuma la BookStore API tramite HTTP/JSON.")

    Rel(catalogManager, webFrontend, "Utilizza", "Browser / App")
    Rel(webFrontend, bookstoreAPI, "Chiama", "HTTPS, JSON, X-API-Key")
    Rel(sysAdmin, bookstoreAPI, "Configura API Key e seed data", "Accesso diretto al DB / script")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

---

## 2. C4 — Container Diagram

Mostra i componenti interni del sistema BookStore API e le loro responsabilità.

```mermaid
C4Container
    title BookStore API — Container Diagram

    Person(client, "Frontend Client", "Web / Mobile App interna")

    System_Boundary(bookstoreSystem, "BookStore API (Node.js Process)") {
        Container(middleware, "Global Middleware", "Express 5", "Auth (X-API-Key), Rate Limiter per API Key, JSON parser, Error handler globale")
        Container(routesBooks, "Books Router", "Express Router", "POST/GET/PATCH/DELETE /api/v1/books\nGestisce creazione, lista, dettaglio, aggiornamento e cancellazione libri")
        Container(routesAuthors, "Authors Router", "Express Router", "CRUD /api/v1/authors\nGestisce anagrafica autori con protezione dipendenze")
        Container(routesPublishers, "Publishers Router", "Express Router", "CRUD /api/v1/publishers\nGestisce anagrafica editori con protezione dipendenze")
        Container(routesGenres, "Genres Router", "Express Router", "GET /api/v1/genres (sola lettura)\nRestituisce i generi predefiniti")
        Container(validators, "Validators", "Joi", "Schema di validazione per ogni risorsa. Middleware centralizzato applicato alle route di scrittura.")
        Container(dbLayer, "DB Layer", "better-sqlite3", "Query helpers sincroni per ogni entità. Gestione transazioni per operazioni multi-tabella.")
    }

    ContainerDb(sqlite, "SQLite Database", "SQLite 3 — File .db", "Tabelle: books, authors, publishers, genres, book_authors, book_genres, api_keys")

    Rel(client, middleware, "HTTP Request", "HTTPS + X-API-Key")
    Rel(middleware, routesBooks, "Proxy se autenticato", "Express routing")
    Rel(middleware, routesAuthors, "Proxy se autenticato", "Express routing")
    Rel(middleware, routesPublishers, "Proxy se autenticato", "Express routing")
    Rel(middleware, routesGenres, "Proxy se autenticato", "Express routing")
    Rel(routesBooks, validators, "Valida input", "Joi schema")
    Rel(routesAuthors, validators, "Valida input", "Joi schema")
    Rel(routesPublishers, validators, "Valida input", "Joi schema")
    Rel(routesBooks, dbLayer, "Legge / Scrive", "Sync API")
    Rel(routesAuthors, dbLayer, "Legge / Scrive", "Sync API")
    Rel(routesPublishers, dbLayer, "Legge / Scrive", "Sync API")
    Rel(routesGenres, dbLayer, "Legge", "Sync API")
    Rel(dbLayer, sqlite, "Query SQL", "better-sqlite3 (sync)")

    UpdateLayoutConfig($c4ShapeInRow="4", $c4BoundaryInRow="1")
```

---

## 3. Sequence Diagram — GET /api/v1/books

Flusso completo di una richiesta lista libri con filtri e paginazione.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Frontend Client
    participant MW as Global Middleware<br/>(Auth + RateLimit)
    participant Router as Books Router
    participant Validator as Joi Validator
    participant DB as DB Layer<br/>(better-sqlite3)
    participant SQLite as SQLite Database

    Client->>MW: GET /api/v1/books?title=harry&genre_id=1&page=2&limit=10<br/>X-API-Key: abc123

    Note over MW: Verifica API Key

    MW->>SQLite: SELECT * FROM api_keys WHERE key = 'abc123'
    SQLite-->>MW: { id: 1, client_name: "WebApp" }

    Note over MW: API Key valida — verifica rate limit

    MW->>MW: Incrementa contatore richieste per key 'abc123'
    MW->>MW: Contatore < 100? → Sì

    MW->>Router: next() — passa la richiesta

    Note over Router: Valida query params

    Router->>Validator: Valida { title, genre_id, page, limit, sort, order }
    Validator-->>Router: Params validi (page=2, limit=10, defaults applicati)

    Note over Router: Costruisce query con filtri

    Router->>DB: getBooks({ title: 'harry', genre_id: 1, page: 2, limit: 10, sort: 'title', order: 'asc' })

    Note over DB: Query con LIKE e JOIN,<br/>calcola offset = (2-1)*10 = 10

    DB->>SQLite: SELECT books.*, GROUP_CONCAT(author_id) AS author_ids,<br/>GROUP_CONCAT(genre_id) AS genre_ids<br/>FROM books<br/>JOIN book_genres ON ...<br/>WHERE title LIKE '%harry%'<br/>AND book_genres.genre_id = 1<br/>GROUP BY books.id<br/>ORDER BY title ASC<br/>LIMIT 10 OFFSET 10

    SQLite-->>DB: rows[ ...10 libri ]

    DB->>SQLite: SELECT COUNT(*) FROM books<br/>WHERE title LIKE '%harry%'<br/>AND ... (stessi filtri, senza LIMIT)

    SQLite-->>DB: { total: 23 }

    DB-->>Router: { books: [...], total: 23 }

    Note over Router: Calcola low_stock per ogni libro

    Router-->>Client: 200 OK<br/>X-RateLimit-Limit: 100<br/>X-RateLimit-Remaining: 87<br/>X-RateLimit-Reset: 1743420600<br/><br/>{ data: [ ...10 libri con low_stock ],<br/>  meta: { page: 2, limit: 10, total: 23 } }
```

---

## 4. Sequence Diagram — POST /api/v1/books

Flusso completo di creazione libro, inclusi validazione, controllo FK e transazione.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Frontend Client
    participant MW as Global Middleware<br/>(Auth + RateLimit)
    participant Router as Books Router
    participant Validator as Joi Validator
    participant DB as DB Layer<br/>(better-sqlite3)
    participant SQLite as SQLite Database

    Client->>MW: POST /api/v1/books<br/>X-API-Key: abc123<br/>Content-Type: application/json<br/>{ title, isbn, price, quantity,<br/>  publication_year, publisher_id,<br/>  author_ids, genre_ids }

    Note over MW: Verifica API Key

    MW->>SQLite: SELECT * FROM api_keys WHERE key = 'abc123'
    SQLite-->>MW: { id: 1, client_name: "WebApp" }
    MW->>MW: Verifica rate limit → OK
    MW->>Router: next()

    Note over Router: Validazione Joi

    Router->>Validator: Valida body request
    
    alt Payload non valido (campo mancante o formato errato)
        Validator-->>Router: ValidationError { details: [...] }
        Router-->>Client: 400 Bad Request<br/>{ error: { code: "VALIDATION_ERROR",<br/>  details: [ { field: "isbn", ... } ] } }
    else Payload valido
        Validator-->>Router: Dati validati

        Note over Router: Verifica esistenza FK prima della transazione

        Router->>DB: publisherExists(publisher_id)
        DB->>SQLite: SELECT id FROM publishers WHERE id = ?
        SQLite-->>DB: row / null

        alt publisher_id non esiste
            DB-->>Router: null
            Router-->>Client: 400 Bad Request<br/>{ error: { code: "VALIDATION_ERROR",<br/>  details: [ { field: "publisher_id" } ] } }
        else publisher esiste

            Router->>DB: authorsExist(author_ids)
            DB->>SQLite: SELECT id FROM authors WHERE id IN (...)
            SQLite-->>DB: rows trovati

            alt author_ids contiene id inesistenti
                DB-->>Router: ids mancanti
                Router-->>Client: 400 Bad Request<br/>{ error: { code: "VALIDATION_ERROR",<br/>  details: [ { field: "author_ids" } ] } }
            else tutti gli autori esistono

                Router->>DB: genresExist(genre_ids)
                DB->>SQLite: SELECT id FROM genres WHERE id IN (...)
                SQLite-->>DB: rows trovati

                alt genre_ids contiene id inesistenti
                    DB-->>Router: ids mancanti
                    Router-->>Client: 400 Bad Request<br/>{ error: { code: "VALIDATION_ERROR",<br/>  details: [ { field: "genre_ids" } ] } }
                else tutti i generi esistono

                    Note over DB,SQLite: Avvia transazione atomica

                    Router->>DB: createBook(bookData, author_ids, genre_ids)
                    DB->>SQLite: BEGIN TRANSACTION

                    DB->>SQLite: INSERT INTO books (title, isbn, price, ...)<br/>VALUES (?, ?, ?, ...)

                    alt ISBN già presente (UNIQUE constraint violation)
                        SQLite-->>DB: SQLITE_CONSTRAINT_UNIQUE
                        DB->>SQLite: ROLLBACK
                        DB-->>Router: DuplicateISBNError
                        Router-->>Client: 409 Conflict<br/>{ error: { code: "DUPLICATE_ISBN" } }
                    else INSERT riuscito
                        SQLite-->>DB: lastInsertRowid = 42

                        DB->>SQLite: INSERT INTO book_authors (book_id, author_id)<br/>VALUES (42, ?), (42, ?), ...
                        SQLite-->>DB: OK

                        DB->>SQLite: INSERT INTO book_genres (book_id, genre_id)<br/>VALUES (42, ?), (42, ?), ...
                        SQLite-->>DB: OK

                        DB->>SQLite: COMMIT
                        SQLite-->>DB: OK

                        DB->>SQLite: SELECT libro completo con author_ids e genre_ids<br/>WHERE books.id = 42
                        SQLite-->>DB: { id: 42, title, isbn, ..., author_ids, genre_ids }

                        DB-->>Router: newBook
                        Router-->>Client: 201 Created<br/>X-RateLimit-Limit: 100<br/>X-RateLimit-Remaining: 86<br/><br/>{ data: { id: 42, title, isbn, price,<br/>  quantity, low_stock: false,<br/>  publisher_id, author_ids, genre_ids,<br/>  created_at, updated_at } }
                    end
                end
            end
        end
    end
```

---

> I diagrammi C4 richiedono il plugin/renderer Mermaid con supporto `C4Context` / `C4Container` (Mermaid >= 10.x).  
> I sequence diagram sono compatibili con qualsiasi renderer Mermaid standard.
