# BookStore API — Specifica dei Requisiti

**Versione**: 1.0  
**Data**: 2026-03-31  
**Stato**: Approvato  

---

## Executive Summary

Sistema di gestione inventario interno per una libreria, esposto come REST API consumata da un frontend web/mobile sviluppato internamente. L'API fornisce il pieno controllo del catalogo: gestione libri, autori, editori, generi e stock. Il sistema gestisce decine di migliaia di libri, è protetto da API Key per client e include rate limiting.

**Stack tecnologico**: Node.js, Express 5, SQLite (better-sqlite3), Joi, Jest + Supertest.

---

## Glossario del Dominio

| Termine | Definizione |
|---|---|
| **Book** | Entita catalogo che rappresenta un titolo in vendita, con attributi descrittivi e quantita in stock |
| **Author** | Persona fisica che ha scritto uno o piu libri. Relazione many-to-many con Book |
| **Publisher** | Editore/casa editrice. Relazione one-to-many con Book (un libro ha esattamente un editore) |
| **Genre** | Categoria tematica predefinita e immutabile. Relazione many-to-many con Book |
| **ISBN-10** | International Standard Book Number a 10 cifre (ultima cifra puo essere 'X'). Identificativo univoco obbligatorio per ogni libro |
| **Stock** | Quantita numerica di copie disponibili per un dato libro. Minimo 0, mai negativo |
| **Low Stock** | Condizione in cui lo stock di un libro scende a 5 unita o meno. Segnalata da flag `low_stock: true` nella risposta API |
| **API Key** | Chiave di autenticazione univoca per client/applicazione, passata via header `X-API-Key` |

---

## Requisiti Funzionali

### RF-01: Gestione Libri

#### RF-01.1: Creazione libro

```
AS A gestore del catalogo
I WANT creare un nuovo libro nel sistema
SO THAT il catalogo rifletta i titoli disponibili in negozio

ACCEPTANCE CRITERIA:

- GIVEN un payload valido con titolo, ISBN-10, prezzo, quantita, anno di pubblicazione,
  descrizione, publisher_id, lista di author_ids e lista di genre_ids
  WHEN invio POST /books
  THEN il libro viene creato e restituito con status 201 e i dati completi incluso l'id generato

- GIVEN un ISBN-10 gia presente nel sistema
  WHEN invio POST /books con lo stesso ISBN
  THEN ricevo errore 409 Conflict con codice "DUPLICATE_ISBN"

- GIVEN un ISBN-10 con formato non valido (non rispetta formato ISBN-10 con check digit)
  WHEN invio POST /books
  THEN ricevo errore 400 con codice "VALIDATION_ERROR" e dettaglio sul campo isbn

- GIVEN un payload con campi obbligatori mancanti
  WHEN invio POST /books
  THEN ricevo errore 400 con codice "VALIDATION_ERROR" e lista dei campi mancanti

- GIVEN un publisher_id che non esiste nel sistema
  WHEN invio POST /books
  THEN ricevo errore 400 con codice "VALIDATION_ERROR" e dettaglio sul campo publisher_id

- GIVEN author_ids contenente un id autore inesistente
  WHEN invio POST /books
  THEN ricevo errore 400 con codice "VALIDATION_ERROR" e dettaglio sul campo author_ids

- GIVEN genre_ids contenente un id genere inesistente
  WHEN invio POST /books
  THEN ricevo errore 400 con codice "VALIDATION_ERROR" e dettaglio sul campo genre_ids

- GIVEN un prezzo pari a 0
  WHEN invio POST /books
  THEN il libro viene creato correttamente (libri omaggio ammessi)

- GIVEN un prezzo negativo
  WHEN invio POST /books
  THEN ricevo errore 400 con codice "VALIDATION_ERROR"

- GIVEN una quantita negativa
  WHEN invio POST /books
  THEN ricevo errore 400 con codice "VALIDATION_ERROR"
```

#### RF-01.2: Lettura lista libri

```
AS A gestore del catalogo
I WANT visualizzare la lista dei libri con filtri, paginazione e ordinamento
SO THAT possa trovare rapidamente i titoli di interesse

ACCEPTANCE CRITERIA:

- GIVEN libri presenti nel catalogo
  WHEN invio GET /books
  THEN ricevo una lista paginata con envelope { data: [...], meta: { page, limit, total } }

- GIVEN il parametro ?title=harry
  WHEN invio GET /books?title=harry
  THEN ricevo solo i libri il cui titolo contiene "harry" (ricerca parziale, case-insensitive)

- GIVEN il parametro ?author_id=5
  WHEN invio GET /books?author_id=5
  THEN ricevo solo i libri che hanno l'autore con id 5 tra i propri autori

- GIVEN il parametro ?genre_id=3
  WHEN invio GET /books?genre_id=3
  THEN ricevo solo i libri che appartengono al genere con id 3

- GIVEN il parametro ?publisher_id=2
  WHEN invio GET /books?publisher_id=2
  THEN ricevo solo i libri pubblicati dall'editore con id 2

- GIVEN i parametri ?page=2&limit=20
  WHEN invio GET /books
  THEN ricevo la seconda pagina con massimo 20 risultati e meta con total corretto

- GIVEN nessun parametro di paginazione
  WHEN invio GET /books
  THEN vengono applicati i default page=1 e limit=20

- GIVEN il parametro ?sort=price&order=asc
  WHEN invio GET /books
  THEN i risultati sono ordinati per prezzo crescente

- GIVEN il parametro ?sort=title
  WHEN invio GET /books
  THEN i risultati sono ordinati per titolo (order default: asc)

- GIVEN parametri sort validi: title, price, publication_year
  WHEN invio un sort con valore non valido
  THEN ricevo errore 400

- GIVEN combinazione di filtri ?title=war&genre_id=1&sort=price&order=desc
  WHEN invio GET /books
  THEN i filtri vengono applicati in AND e i risultati ordinati per prezzo decrescente

- GIVEN la lista libri
  WHEN ricevo la risposta
  THEN ogni libro nella lista contiene solo gli ID di autori, editore e generi (NO eager loading)
  E include il flag "low_stock" (true se quantity <= 5)
```

#### RF-01.3: Lettura dettaglio libro

```
AS A gestore del catalogo
I WANT visualizzare il dettaglio completo di un libro
SO THAT possa vedere tutte le informazioni inclusi autori, editore e generi

ACCEPTANCE CRITERIA:

- GIVEN un libro con id esistente
  WHEN invio GET /books/:id
  THEN ricevo il libro con tutti i campi e i dati annidati (eager loading) di autori,
  editore e generi, e il flag "low_stock"

- GIVEN un id non esistente
  WHEN invio GET /books/:id
  THEN ricevo errore 404 con codice "NOT_FOUND"
```

#### RF-01.4: Aggiornamento parziale libro

```
AS A gestore del catalogo
I WANT aggiornare uno o piu campi di un libro
SO THAT possa correggere informazioni o aggiornare lo stock

ACCEPTANCE CRITERIA:

- GIVEN un libro esistente e un payload con solo i campi da modificare
  WHEN invio PATCH /books/:id
  THEN solo i campi presenti nel payload vengono aggiornati, gli altri restano invariati

- GIVEN un payload con quantity aggiornata a un valore <= 5
  WHEN invio PATCH /books/:id
  THEN il libro viene aggiornato e il campo low_stock nella risposta e true

- GIVEN un payload con quantity negativa
  WHEN invio PATCH /books/:id
  THEN ricevo errore 400 con codice "VALIDATION_ERROR"

- GIVEN un payload con isbn duplicato di un altro libro
  WHEN invio PATCH /books/:id
  THEN ricevo errore 409 Conflict con codice "DUPLICATE_ISBN"

- GIVEN un payload con author_ids
  WHEN invio PATCH /books/:id
  THEN le associazioni autore-libro vengono sostituite completamente con i nuovi author_ids

- GIVEN un payload con genre_ids
  WHEN invio PATCH /books/:id
  THEN le associazioni genere-libro vengono sostituite completamente con i nuovi genre_ids

- GIVEN un id non esistente
  WHEN invio PATCH /books/:id
  THEN ricevo errore 404 con codice "NOT_FOUND"
```

#### RF-01.5: Cancellazione libro

```
AS A gestore del catalogo
I WANT eliminare un libro dal catalogo
SO THAT i titoli non piu gestiti vengano rimossi

ACCEPTANCE CRITERIA:

- GIVEN un libro esistente
  WHEN invio DELETE /books/:id
  THEN il libro e le sue relazioni (autori, generi) vengono eliminati dal database (hard delete)
  e ricevo status 204 No Content

- GIVEN un id non esistente
  WHEN invio DELETE /books/:id
  THEN ricevo errore 404 con codice "NOT_FOUND"
```

---

### RF-02: Gestione Autori

#### RF-02.1: CRUD Autori

```
AS A gestore del catalogo
I WANT gestire l'anagrafica degli autori
SO THAT possa associare correttamente gli autori ai libri

ACCEPTANCE CRITERIA:

--- Creazione ---
- GIVEN un payload valido con first_name, last_name, birth_date (opzionale),
  biography (opzionale), nationality (opzionale)
  WHEN invio POST /authors
  THEN l'autore viene creato e restituito con status 201

- GIVEN un payload senza first_name o last_name
  WHEN invio POST /authors
  THEN ricevo errore 400 con codice "VALIDATION_ERROR"

--- Lista ---
- GIVEN autori presenti nel sistema
  WHEN invio GET /authors
  THEN ricevo la lista paginata con envelope { data, meta }

--- Dettaglio ---
- GIVEN un autore esistente
  WHEN invio GET /authors/:id
  THEN ricevo i dati dell'autore

- GIVEN un id non esistente
  WHEN invio GET /authors/:id
  THEN ricevo errore 404

--- Aggiornamento ---
- GIVEN un autore esistente e un payload parziale
  WHEN invio PATCH /authors/:id
  THEN i campi presenti vengono aggiornati

--- Cancellazione ---
- GIVEN un autore senza libri associati
  WHEN invio DELETE /authors/:id
  THEN l'autore viene eliminato con status 204

- GIVEN un autore con libri associati
  WHEN invio DELETE /authors/:id
  THEN ricevo errore 409 Conflict con codice "HAS_DEPENDENCIES"
  e messaggio che indica i libri associati
```

---

### RF-03: Gestione Editori (Publisher)

#### RF-03.1: CRUD Publisher

```
AS A gestore del catalogo
I WANT gestire l'anagrafica degli editori
SO THAT possa associare correttamente gli editori ai libri

ACCEPTANCE CRITERIA:

--- Creazione ---
- GIVEN un payload valido con name
  WHEN invio POST /publishers
  THEN l'editore viene creato e restituito con status 201

- GIVEN un payload senza name
  WHEN invio POST /publishers
  THEN ricevo errore 400 con codice "VALIDATION_ERROR"

--- Lista ---
- GIVEN editori presenti nel sistema
  WHEN invio GET /publishers
  THEN ricevo la lista paginata con envelope { data, meta }

--- Dettaglio ---
- GIVEN un editore esistente
  WHEN invio GET /publishers/:id
  THEN ricevo i dati dell'editore

--- Aggiornamento ---
- GIVEN un editore esistente
  WHEN invio PATCH /publishers/:id con { name: "Nuovo Nome" }
  THEN il nome viene aggiornato

--- Cancellazione ---
- GIVEN un editore senza libri associati
  WHEN invio DELETE /publishers/:id
  THEN l'editore viene eliminato con status 204

- GIVEN un editore con libri associati
  WHEN invio DELETE /publishers/:id
  THEN ricevo errore 409 Conflict con codice "HAS_DEPENDENCIES"
```

---

### RF-04: Generi (Sola Lettura)

```
AS A gestore del catalogo
I WANT consultare la lista dei generi disponibili
SO THAT possa assegnarli ai libri

ACCEPTANCE CRITERIA:

- GIVEN i generi predefiniti nel sistema
  WHEN invio GET /genres
  THEN ricevo la lista completa dei generi (non paginata, sono pochi)

- GIVEN un genere esistente
  WHEN invio GET /genres/:id
  THEN ricevo il dettaglio del genere

- GIVEN una richiesta POST/PATCH/DELETE su /genres
  WHEN invio la richiesta
  THEN ricevo errore 405 Method Not Allowed
```

**Generi predefiniti:**
1. Fiction
2. Non-Fiction
3. Sci-Fi
4. Fantasy
5. Romance
6. Thriller
7. Horror
8. Biography
9. History
10. Science
11. Children

---

### RF-05: Autenticazione

```
AS A amministratore di sistema
I WANT proteggere l'API con API Key
SO THAT solo le applicazioni autorizzate possano accedere al sistema

ACCEPTANCE CRITERIA:

- GIVEN una richiesta con header X-API-Key valido
  WHEN invio qualsiasi richiesta API
  THEN la richiesta viene elaborata normalmente

- GIVEN una richiesta senza header X-API-Key
  WHEN invio qualsiasi richiesta API
  THEN ricevo errore 401 Unauthorized con codice "MISSING_API_KEY"

- GIVEN una richiesta con API Key non valida
  WHEN invio qualsiasi richiesta API
  THEN ricevo errore 401 Unauthorized con codice "INVALID_API_KEY"

- GIVEN piu applicazioni client
  WHEN ciascuna invia richieste con la propria API Key
  THEN ogni chiave viene validata indipendentemente
```

**Decisione**: Le API Key sono memorizzate nel database (tabella `api_keys`). La gestione CRUD delle chiavi e fuori scope per l'MVP (inserite manualmente nel DB o via seed).

---

### RF-06: Rate Limiting

```
AS A amministratore di sistema
I WANT limitare il numero di richieste per API Key
SO THAT il sistema sia protetto da abusi e sovraccarichi

ACCEPTANCE CRITERIA:

- GIVEN un client che ha effettuato meno di 100 richieste nell'ultimo minuto
  WHEN invia una nuova richiesta
  THEN la richiesta viene elaborata normalmente

- GIVEN un client che ha raggiunto 100 richieste nell'ultimo minuto
  WHEN invia una nuova richiesta
  THEN ricevo errore 429 Too Many Requests con header Retry-After (secondi rimanenti)

- GIVEN ogni risposta API
  WHEN il client la riceve
  THEN contiene gli header X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
```

**Soglia**: 100 richieste/minuto per API Key.

---

## Requisiti Non Funzionali

### RNF-01: Performance

| Metrica | Target |
|---|---|
| Response time (p95) per operazioni di lettura | < 200ms |
| Response time (p95) per operazioni di scrittura | < 500ms |
| Supporto volume dati | Decine di migliaia di libri |

**Implicazione**: indici database su ISBN, titolo, e foreign key delle tabelle di relazione.

### RNF-02: Sicurezza

- Tutte le richieste devono essere autenticate via API Key (header `X-API-Key`)
- Rate limiting a 100 req/min per API Key
- Input validation su tutti gli endpoint che accettano dati (Joi)
- Nessun dato sensibile nei log o nelle risposte di errore

### RNF-03: Affidabilita

- Le operazioni di scrittura che coinvolgono piu tabelle (es. creazione libro con autori e generi) devono essere eseguite in una transazione database
- Lo stock non puo mai scendere sotto zero a livello di vincolo DB

### RNF-04: Manutenibilita

- Separazione responsabilita: routes, validators, db layer
- Test di integrazione con Jest + Supertest per tutti gli endpoint
- Validazione input centralizzata tramite middleware Joi

---

## Modello Dati

### Entita e Attributi

#### books
| Campo | Tipo | Vincoli |
|---|---|---|
| id | INTEGER | PK, AUTO INCREMENT |
| title | TEXT | NOT NULL |
| isbn | TEXT(10) | NOT NULL, UNIQUE, formato ISBN-10 valido |
| price | REAL | NOT NULL, >= 0 |
| quantity | INTEGER | NOT NULL, >= 0, DEFAULT 0 |
| publication_year | INTEGER | NOT NULL |
| description | TEXT | NULLABLE |
| publisher_id | INTEGER | NOT NULL, FK -> publishers(id) |
| created_at | TEXT (ISO 8601) | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| updated_at | TEXT (ISO 8601) | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

#### authors
| Campo | Tipo | Vincoli |
|---|---|---|
| id | INTEGER | PK, AUTO INCREMENT |
| first_name | TEXT | NOT NULL |
| last_name | TEXT | NOT NULL |
| birth_date | TEXT (YYYY-MM-DD) | NULLABLE |
| biography | TEXT | NULLABLE |
| nationality | TEXT | NULLABLE |
| created_at | TEXT (ISO 8601) | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| updated_at | TEXT (ISO 8601) | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

#### publishers
| Campo | Tipo | Vincoli |
|---|---|---|
| id | INTEGER | PK, AUTO INCREMENT |
| name | TEXT | NOT NULL |
| created_at | TEXT (ISO 8601) | NOT NULL, DEFAULT CURRENT_TIMESTAMP |
| updated_at | TEXT (ISO 8601) | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

#### genres
| Campo | Tipo | Vincoli |
|---|---|---|
| id | INTEGER | PK, AUTO INCREMENT |
| name | TEXT | NOT NULL, UNIQUE |

**Nota**: tabella pre-popolata via seed, sola lettura da API.

#### book_authors (tabella ponte)
| Campo | Tipo | Vincoli |
|---|---|---|
| book_id | INTEGER | PK, FK -> books(id) ON DELETE CASCADE |
| author_id | INTEGER | PK, FK -> authors(id) ON DELETE RESTRICT |

#### book_genres (tabella ponte)
| Campo | Tipo | Vincoli |
|---|---|---|
| book_id | INTEGER | PK, FK -> books(id) ON DELETE CASCADE |
| genre_id | INTEGER | PK, FK -> genres(id) ON DELETE RESTRICT |

#### api_keys
| Campo | Tipo | Vincoli |
|---|---|---|
| id | INTEGER | PK, AUTO INCREMENT |
| key | TEXT | NOT NULL, UNIQUE |
| client_name | TEXT | NOT NULL |
| created_at | TEXT (ISO 8601) | NOT NULL, DEFAULT CURRENT_TIMESTAMP |

### Relazioni

```
publishers 1 --- * books
books * --- * authors  (tramite book_authors)
books * --- * genres   (tramite book_genres)
```

### Indici

- `books.isbn` — UNIQUE (gia dal vincolo)
- `books.title` — INDEX (per ricerca parziale)
- `books.publisher_id` — INDEX (per filtro e FK)
- `book_authors.author_id` — INDEX (per filtro libri per autore)
- `book_genres.genre_id` — INDEX (per filtro libri per genere)

---

## API Contract

**Base URL**: `/api/v1`  
**Content-Type**: `application/json`  
**Autenticazione**: Header `X-API-Key: <chiave>`

### Formato Risposta Standard

**Successo (singola risorsa)**:
```json
{
  "data": { ... }
}
```

**Successo (lista)**:
```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 342
  }
}
```

**Errore**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Descrizione leggibile dell'errore",
    "details": [
      { "field": "isbn", "message": "ISBN format is invalid" }
    ]
  }
}
```

---

### Books

#### POST /api/v1/books

Crea un nuovo libro.

**Request Body**:
```json
{
  "title": "Il Nome della Rosa",
  "isbn": "0151446474",
  "price": 15.90,
  "quantity": 25,
  "publication_year": 1980,
  "description": "Un romanzo storico di Umberto Eco",
  "publisher_id": 1,
  "author_ids": [1],
  "genre_ids": [1, 9]
}
```

| Campo | Tipo | Obbligatorio | Vincoli |
|---|---|---|---|
| title | string | Si | min 1 carattere |
| isbn | string | Si | ISBN-10 valido con check digit |
| price | number | Si | >= 0 |
| quantity | integer | Si | >= 0 |
| publication_year | integer | Si | - |
| description | string | No | - |
| publisher_id | integer | Si | deve esistere |
| author_ids | array of integer | Si | almeno 1, devono esistere |
| genre_ids | array of integer | Si | almeno 1, devono esistere |

**Risposte**:
| Status | Codice | Quando |
|---|---|---|
| 201 Created | - | Libro creato con successo |
| 400 Bad Request | VALIDATION_ERROR | Payload non valido |
| 409 Conflict | DUPLICATE_ISBN | ISBN gia presente |

---

#### GET /api/v1/books

Lista libri con filtri, paginazione e ordinamento.

**Query Parameters**:
| Parametro | Tipo | Default | Descrizione |
|---|---|---|---|
| title | string | - | Ricerca parziale case-insensitive |
| author_id | integer | - | Filtra per autore |
| genre_id | integer | - | Filtra per genere |
| publisher_id | integer | - | Filtra per editore |
| page | integer | 1 | Pagina corrente |
| limit | integer | 20 | Risultati per pagina (max 100) |
| sort | string | title | Campo di ordinamento: title, price, publication_year |
| order | string | asc | Direzione: asc, desc |

**Risposta 200**:
```json
{
  "data": [
    {
      "id": 1,
      "title": "Il Nome della Rosa",
      "isbn": "0151446474",
      "price": 15.90,
      "quantity": 25,
      "publication_year": 1980,
      "description": "Un romanzo storico di Umberto Eco",
      "publisher_id": 1,
      "author_ids": [1],
      "genre_ids": [1, 9],
      "low_stock": false,
      "created_at": "2026-03-31T10:00:00.000Z",
      "updated_at": "2026-03-31T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1
  }
}
```

**Nota**: nella lista, autori e generi sono restituiti come array di ID, non come oggetti annidati.

---

#### GET /api/v1/books/:id

Dettaglio libro con dati annidati (eager loading).

**Risposta 200**:
```json
{
  "data": {
    "id": 1,
    "title": "Il Nome della Rosa",
    "isbn": "0151446474",
    "price": 15.90,
    "quantity": 25,
    "publication_year": 1980,
    "description": "Un romanzo storico di Umberto Eco",
    "low_stock": false,
    "publisher": {
      "id": 1,
      "name": "Bompiani"
    },
    "authors": [
      {
        "id": 1,
        "first_name": "Umberto",
        "last_name": "Eco",
        "birth_date": "1932-01-05",
        "biography": "Scrittore e semiologo italiano",
        "nationality": "Italian"
      }
    ],
    "genres": [
      { "id": 1, "name": "Fiction" },
      { "id": 9, "name": "History" }
    ],
    "created_at": "2026-03-31T10:00:00.000Z",
    "updated_at": "2026-03-31T10:00:00.000Z"
  }
}
```

| Status | Codice | Quando |
|---|---|---|
| 200 OK | - | Libro trovato |
| 404 Not Found | NOT_FOUND | ID non esistente |

---

#### PATCH /api/v1/books/:id

Aggiornamento parziale. Solo i campi presenti nel body vengono aggiornati.

**Request Body** (tutti i campi opzionali):
```json
{
  "quantity": 3,
  "price": 12.50
}
```

**Nota**: se si inviano `author_ids` o `genre_ids`, le associazioni vengono **sostituite completamente**.

| Status | Codice | Quando |
|---|---|---|
| 200 OK | - | Aggiornamento riuscito (restituisce libro aggiornato) |
| 400 Bad Request | VALIDATION_ERROR | Payload non valido |
| 404 Not Found | NOT_FOUND | ID non esistente |
| 409 Conflict | DUPLICATE_ISBN | ISBN gia in uso da un altro libro |

---

#### DELETE /api/v1/books/:id

Cancellazione definitiva (hard delete) del libro e delle sue relazioni.

| Status | Codice | Quando |
|---|---|---|
| 204 No Content | - | Cancellazione riuscita |
| 404 Not Found | NOT_FOUND | ID non esistente |

---

### Authors

#### POST /api/v1/authors

**Request Body**:
```json
{
  "first_name": "Umberto",
  "last_name": "Eco",
  "birth_date": "1932-01-05",
  "biography": "Scrittore e semiologo italiano",
  "nationality": "Italian"
}
```

| Campo | Tipo | Obbligatorio |
|---|---|---|
| first_name | string | Si |
| last_name | string | Si |
| birth_date | string (YYYY-MM-DD) | No |
| biography | string | No |
| nationality | string | No |

| Status | Codice | Quando |
|---|---|---|
| 201 Created | - | Autore creato |
| 400 Bad Request | VALIDATION_ERROR | Payload non valido |

#### GET /api/v1/authors

Lista paginata. Stessi parametri di paginazione di /books (page, limit).

#### GET /api/v1/authors/:id

Dettaglio autore.

| Status | Codice | Quando |
|---|---|---|
| 200 OK | - | Trovato |
| 404 Not Found | NOT_FOUND | Non trovato |

#### PATCH /api/v1/authors/:id

Aggiornamento parziale.

| Status | Codice | Quando |
|---|---|---|
| 200 OK | - | Aggiornato |
| 400 Bad Request | VALIDATION_ERROR | Payload non valido |
| 404 Not Found | NOT_FOUND | Non trovato |

#### DELETE /api/v1/authors/:id

| Status | Codice | Quando |
|---|---|---|
| 204 No Content | - | Cancellato |
| 404 Not Found | NOT_FOUND | Non trovato |
| 409 Conflict | HAS_DEPENDENCIES | Ha libri associati |

---

### Publishers

#### POST /api/v1/publishers

**Request Body**:
```json
{
  "name": "Bompiani"
}
```

| Campo | Tipo | Obbligatorio |
|---|---|---|
| name | string | Si |

| Status | Codice | Quando |
|---|---|---|
| 201 Created | - | Editore creato |
| 400 Bad Request | VALIDATION_ERROR | Payload non valido |

#### GET /api/v1/publishers

Lista paginata.

#### GET /api/v1/publishers/:id

Dettaglio editore.

#### PATCH /api/v1/publishers/:id

Aggiornamento parziale.

#### DELETE /api/v1/publishers/:id

| Status | Codice | Quando |
|---|---|---|
| 204 No Content | - | Cancellato |
| 404 Not Found | NOT_FOUND | Non trovato |
| 409 Conflict | HAS_DEPENDENCIES | Ha libri associati |

---

### Genres

#### GET /api/v1/genres

Lista completa (non paginata).

**Risposta 200**:
```json
{
  "data": [
    { "id": 1, "name": "Fiction" },
    { "id": 2, "name": "Non-Fiction" },
    { "id": 3, "name": "Sci-Fi" },
    { "id": 4, "name": "Fantasy" },
    { "id": 5, "name": "Romance" },
    { "id": 6, "name": "Thriller" },
    { "id": 7, "name": "Horror" },
    { "id": 8, "name": "Biography" },
    { "id": 9, "name": "History" },
    { "id": 10, "name": "Science" },
    { "id": 11, "name": "Children" }
  ]
}
```

#### GET /api/v1/genres/:id

Dettaglio singolo genere.

#### POST, PATCH, DELETE /api/v1/genres

**Status 405 Method Not Allowed** per qualsiasi operazione di scrittura.

---

## Edge Case e Error Handling

### Errori Globali

| Scenario | Status | Codice |
|---|---|---|
| API Key mancante | 401 | MISSING_API_KEY |
| API Key non valida | 401 | INVALID_API_KEY |
| Rate limit superato | 429 | RATE_LIMIT_EXCEEDED |
| Risorsa non trovata (ID) | 404 | NOT_FOUND |
| Metodo non permesso | 405 | METHOD_NOT_ALLOWED |
| Validazione fallita | 400 | VALIDATION_ERROR |
| Duplicato ISBN | 409 | DUPLICATE_ISBN |
| Cancellazione con dipendenze | 409 | HAS_DEPENDENCIES |
| Errore interno server | 500 | INTERNAL_ERROR |

### Edge Case Specifici

| Caso | Comportamento |
|---|---|
| ISBN con 'X' come ultimo carattere | Accettato (valido in ISBN-10) |
| Prezzo = 0 | Accettato (libro omaggio) |
| Quantita = 0 | Accettato (libro esaurito, low_stock = true) |
| PATCH con body vuoto `{}` | Restituisce il libro invariato con 200 |
| PATCH con campi sconosciuti | Campi sconosciuti vengono ignorati |
| page o limit con valori non numerici | Errore 400 VALIDATION_ERROR |
| limit > 100 | Errore 400 VALIDATION_ERROR |
| Filtri multipli su GET /books | Applicati in AND |
| ID non numerico nell'URL (es. /books/abc) | Errore 400 VALIDATION_ERROR |

---

## Vincoli e Dipendenze

### Vincoli Tecnici
- **Database**: SQLite - singolo file, no concorrenza in scrittura. Adeguato per il volume previsto (decine di migliaia di record) e uso interno
- **better-sqlite3**: API sincrona, nessun uso di async/await per le query
- **Transazioni**: tutte le operazioni multi-tabella (creazione/update libro con relazioni) devono usare transazioni SQLite
- **FOREIGN KEY**: abilitare `PRAGMA foreign_keys = ON` all'avvio della connessione

### Dipendenze Esterne
Nessuna dipendenza esterna. Il sistema e self-contained.

### Seed Data
- Tabella `genres` pre-popolata con gli 11 generi definiti
- Tabella `api_keys` con almeno una chiave per lo sviluppo

---

## Decisioni Architetturali

| Decisione | Razionale |
|---|---|
| Hard delete per i libri | Requisito esplicito. Semplifica il modello, ma i dati sono irrecuperabili |
| Rifiuto cancellazione autori/publisher con dipendenze (409) | Protegge l'integrita referenziale senza perdita di dati |
| Eager loading solo nel dettaglio singolo libro | Performance: evita N+1 query sulle liste con decine di migliaia di record |
| Generi in sola lettura | Lista fissa, cambiamenti richiedono un deploy (seed migration) |
| API Key in DB | Permette gestione multi-client senza redeploy |
| Rate limiting per API Key | Ogni client ha il proprio budget di richieste |
| ISBN-10 con validazione check digit | Garantisce integrita del dato alla fonte |
| Envelope standard per tutte le risposte | Consistenza per il frontend, facilita gestione paginazione |

---

## Domande Aperte

Nessuna domanda aperta rimasta. Tutti i requisiti sono stati confermati durante l'intervista.
