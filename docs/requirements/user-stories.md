# User Stories — BookStore API

**Versione**: 1.0  
**Data**: 2026-03-31  
**Formato criteri di accettazione**: EARS (Easy Approach to Requirements Syntax)

---

## Indice

- [US-01: Creazione libro](#us-01-creazione-libro)
- [US-02: Lista libri](#us-02-lista-libri)
- [US-03: Dettaglio libro](#us-03-dettaglio-libro)
- [US-04: Aggiornamento libro](#us-04-aggiornamento-libro)
- [US-05: Cancellazione libro](#us-05-cancellazione-libro)
- [US-06: Gestione autori](#us-06-gestione-autori)
- [US-07: Gestione editori](#us-07-gestione-editori)
- [US-08: Consultazione generi](#us-08-consultazione-generi)
- [US-09: Autenticazione API Key](#us-09-autenticazione-api-key)
- [US-10: Rate Limiting](#us-10-rate-limiting)

---

## US-01: Creazione libro

**Come** gestore del catalogo,  
**voglio** creare un nuovo libro nel sistema,  
**così che** il catalogo rifletta i titoli disponibili in negozio.

**Endpoint**: `POST /api/v1/books`

### Criteri di accettazione (EARS)

**AC-01.1** — Creazione con payload valido  
WHEN il gestore invia `POST /api/v1/books` con titolo, ISBN-10 valido, prezzo ≥ 0, quantità ≥ 0, anno di pubblicazione, publisher_id esistente, almeno un author_id esistente e almeno un genre_id esistente,  
THEN il sistema crea il libro, lo persiste nel database in una singola transazione e restituisce `201 Created` con il corpo `{ "data": { ...libro con id generato } }`.

**AC-01.2** — ISBN duplicato  
WHEN il gestore invia `POST /api/v1/books` con un ISBN già presente nel sistema,  
THEN il sistema restituisce `409 Conflict` con `{ "error": { "code": "DUPLICATE_ISBN" } }` e non crea alcun record.

**AC-01.3** — ISBN con formato non valido  
WHEN il gestore invia `POST /api/v1/books` con un ISBN-10 che non rispetta il check digit,  
THEN il sistema restituisce `400 Bad Request` con `{ "error": { "code": "VALIDATION_ERROR", "details": [{ "field": "isbn", ... }] } }`.

**AC-01.4** — Campi obbligatori mancanti  
WHEN il gestore invia `POST /api/v1/books` con uno o più campi obbligatori assenti,  
THEN il sistema restituisce `400 Bad Request` con `VALIDATION_ERROR` e la lista dei campi mancanti nei `details`.

**AC-01.5** — publisher_id inesistente  
WHEN il gestore invia `POST /api/v1/books` con un `publisher_id` che non esiste nel database,  
THEN il sistema restituisce `400 Bad Request` con `VALIDATION_ERROR` e `details` che indica il campo `publisher_id`.

**AC-01.6** — author_ids con id inesistente  
WHEN il gestore invia `POST /api/v1/books` con `author_ids` contenente almeno un id che non esiste nel database,  
THEN il sistema restituisce `400 Bad Request` con `VALIDATION_ERROR` e `details` che indica il campo `author_ids`.

**AC-01.7** — genre_ids con id inesistente  
WHEN il gestore invia `POST /api/v1/books` con `genre_ids` contenente almeno un id che non esiste nel database,  
THEN il sistema restituisce `400 Bad Request` con `VALIDATION_ERROR` e `details` che indica il campo `genre_ids`.

**AC-01.8** — Prezzo pari a zero (libro omaggio)  
WHEN il gestore invia `POST /api/v1/books` con `price: 0` e tutti gli altri campi validi,  
THEN il sistema crea il libro normalmente e restituisce `201 Created`.

**AC-01.9** — Prezzo negativo  
WHEN il gestore invia `POST /api/v1/books` con `price` negativo,  
THEN il sistema restituisce `400 Bad Request` con `VALIDATION_ERROR`.

**AC-01.10** — Quantità negativa  
WHEN il gestore invia `POST /api/v1/books` con `quantity` negativo,  
THEN il sistema restituisce `400 Bad Request` con `VALIDATION_ERROR`.

**AC-01.11** — ISBN con carattere 'X' finale  
WHEN il gestore invia `POST /api/v1/books` con un ISBN-10 valido la cui ultima cifra è 'X',  
THEN il sistema accetta il valore e crea il libro con `201 Created`.

### Test case principali

| ID | Scenario | Input | Expected |
|----|----------|-------|----------|
| TC-01.1 | Payload completo e valido | Tutti i campi corretti | `201`, libro restituito con `id` |
| TC-01.2 | ISBN già esistente | ISBN duplicato | `409 DUPLICATE_ISBN` |
| TC-01.3 | ISBN check digit errato | `"isbn": "0151446470"` (digit sbagliato) | `400 VALIDATION_ERROR field=isbn` |
| TC-01.4 | Manca `title` | Payload senza `title` | `400 VALIDATION_ERROR` con `title` in details |
| TC-01.5 | Manca `author_ids` | Payload senza `author_ids` | `400 VALIDATION_ERROR` |
| TC-01.6 | `publisher_id: 99999` | ID editore inesistente | `400 VALIDATION_ERROR field=publisher_id` |
| TC-01.7 | `author_ids: [99999]` | ID autore inesistente | `400 VALIDATION_ERROR field=author_ids` |
| TC-01.8 | `price: 0` | Libro omaggio | `201 Created` |
| TC-01.9 | `price: -5` | Prezzo negativo | `400 VALIDATION_ERROR` |
| TC-01.10 | `quantity: -1` | Quantità negativa | `400 VALIDATION_ERROR` |
| TC-01.11 | ISBN con 'X' finale | `"isbn": "080442957X"` | `201 Created` |
| TC-01.12 | `quantity: 5` (low stock) | Quantità al limite | `201`, risposta include `"low_stock": true` |

---

## US-02: Lista libri

**Come** gestore del catalogo,  
**voglio** visualizzare la lista dei libri con filtri, paginazione e ordinamento,  
**così che** possa trovare rapidamente i titoli di interesse.

**Endpoint**: `GET /api/v1/books`

### Criteri di accettazione (EARS)

**AC-02.1** — Lista paginata di default  
WHEN il gestore invia `GET /api/v1/books` senza parametri,  
THEN il sistema restituisce `200 OK` con envelope `{ "data": [...], "meta": { "page": 1, "limit": 20, "total": N } }`.

**AC-02.2** — Filtro per titolo (parziale, case-insensitive)  
WHEN il gestore invia `GET /api/v1/books?title=harry`,  
THEN il sistema restituisce solo i libri il cui titolo contiene "harry" (confronto case-insensitive).

**AC-02.3** — Filtro per autore  
WHEN il gestore invia `GET /api/v1/books?author_id=5`,  
THEN il sistema restituisce solo i libri che hanno l'autore con id 5 tra i propri autori.

**AC-02.4** — Filtro per genere  
WHEN il gestore invia `GET /api/v1/books?genre_id=3`,  
THEN il sistema restituisce solo i libri appartenenti al genere con id 3.

**AC-02.5** — Filtro per editore  
WHEN il gestore invia `GET /api/v1/books?publisher_id=2`,  
THEN il sistema restituisce solo i libri pubblicati dall'editore con id 2.

**AC-02.6** — Paginazione esplicita  
WHEN il gestore invia `GET /api/v1/books?page=2&limit=20`,  
THEN il sistema restituisce la seconda pagina con al massimo 20 risultati e il campo `meta.total` riflette il numero totale di record corrispondenti ai filtri applicati.

**AC-02.7** — Ordinamento per campo valido  
WHEN il gestore invia `GET /api/v1/books?sort=price&order=asc`,  
THEN il sistema restituisce i risultati ordinati per prezzo crescente.

**AC-02.8** — Ordinamento default per titolo  
WHEN il gestore invia `GET /api/v1/books?sort=title` senza specificare `order`,  
THEN il sistema ordina per titolo in direzione ascendente (default `order=asc`).

**AC-02.9** — Campo di ordinamento non valido  
WHEN il gestore invia `GET /api/v1/books?sort=unknown_field`,  
THEN il sistema restituisce `400 Bad Request` con `VALIDATION_ERROR`.

**AC-02.10** — Filtri combinati in AND  
WHEN il gestore invia `GET /api/v1/books?title=war&genre_id=1&sort=price&order=desc`,  
THEN il sistema applica tutti i filtri contemporaneamente (AND logico) e ordina per prezzo decrescente.

**AC-02.11** — Struttura risposta: solo ID per relazioni  
WHEN il gestore riceve la risposta di `GET /api/v1/books`,  
THEN ogni libro nella lista contiene `author_ids` (array di interi) e `genre_ids` (array di interi) anziché oggetti annidati, e `publisher_id` come intero.

**AC-02.12** — Flag low_stock nella lista  
WHEN il gestore riceve la risposta di `GET /api/v1/books`,  
THEN ogni libro con `quantity <= 5` ha `"low_stock": true`, ogni libro con `quantity > 5` ha `"low_stock": false`.

**AC-02.13** — Limit superiore al massimo  
WHEN il gestore invia `GET /api/v1/books?limit=200`,  
THEN il sistema restituisce `400 Bad Request` con `VALIDATION_ERROR`.

**AC-02.14** — Parametri di paginazione non numerici  
WHEN il gestore invia `GET /api/v1/books?page=abc`,  
THEN il sistema restituisce `400 Bad Request` con `VALIDATION_ERROR`.

### Test case principali

| ID | Scenario | Input | Expected |
|----|----------|-------|----------|
| TC-02.1 | Nessun parametro | `GET /books` | `200`, `meta.page=1`, `meta.limit=20` |
| TC-02.2 | Filtro title parziale | `?title=harry` | Solo libri con "harry" nel titolo (case-insensitive) |
| TC-02.3 | Filtro author_id | `?author_id=1` | Solo libri dell'autore 1 |
| TC-02.4 | Filtro genre_id | `?genre_id=3` | Solo libri del genere 3 |
| TC-02.5 | Filtro publisher_id | `?publisher_id=1` | Solo libri dell'editore 1 |
| TC-02.6 | Paginazione seconda pagina | `?page=2&limit=5` | 5 record dalla posizione 6 |
| TC-02.7 | Sort price asc | `?sort=price&order=asc` | Lista ordinata per prezzo crescente |
| TC-02.8 | Sort price desc | `?sort=price&order=desc` | Lista ordinata per prezzo decrescente |
| TC-02.9 | Sort campo invalido | `?sort=isbn` | `400 VALIDATION_ERROR` |
| TC-02.10 | Filtri combinati | `?title=the&genre_id=1&sort=price&order=desc` | Filtri in AND, ordinati |
| TC-02.11 | Struttura risposta | `GET /books` | `author_ids` e `genre_ids` sono array di interi |
| TC-02.12 | Low stock flag | Libro con `quantity=5` | `"low_stock": true` |
| TC-02.13 | Limit eccessivo | `?limit=101` | `400 VALIDATION_ERROR` |
| TC-02.14 | Page non numerica | `?page=abc` | `400 VALIDATION_ERROR` |
| TC-02.15 | Lista vuota | Nessun libro corrisponde ai filtri | `200`, `data: []`, `meta.total: 0` |

---

## US-03: Dettaglio libro

**Come** gestore del catalogo,  
**voglio** visualizzare il dettaglio completo di un libro,  
**così che** possa vedere tutte le informazioni inclusi autori, editore e generi.

**Endpoint**: `GET /api/v1/books/:id`

### Criteri di accettazione (EARS)

**AC-03.1** — Libro esistente con eager loading  
WHEN il gestore invia `GET /api/v1/books/:id` con un id esistente,  
THEN il sistema restituisce `200 OK` con il libro completo che include gli oggetti annidati `publisher` (con tutti i campi), `authors` (array di oggetti) e `genres` (array di oggetti), oltre al flag `low_stock`.

**AC-03.2** — ID non esistente  
WHEN il gestore invia `GET /api/v1/books/:id` con un id che non esiste nel database,  
THEN il sistema restituisce `404 Not Found` con `{ "error": { "code": "NOT_FOUND" } }`.

**AC-03.3** — ID non numerico  
WHEN il gestore invia `GET /api/v1/books/abc`,  
THEN il sistema restituisce `400 Bad Request` con `VALIDATION_ERROR`.

**AC-03.4** — Flag low_stock nel dettaglio  
WHEN il gestore richiede il dettaglio di un libro con `quantity <= 5`,  
THEN la risposta contiene `"low_stock": true`.

### Test case principali

| ID | Scenario | Input | Expected |
|----|----------|-------|----------|
| TC-03.1 | ID valido e esistente | `GET /books/1` | `200`, oggetti annidati `publisher`, `authors`, `genres` |
| TC-03.2 | ID inesistente | `GET /books/99999` | `404 NOT_FOUND` |
| TC-03.3 | ID non numerico | `GET /books/abc` | `400 VALIDATION_ERROR` |
| TC-03.4 | Libro con quantity=0 | `GET /books/:id` | `"low_stock": true` |
| TC-03.5 | Libro con quantity=6 | `GET /books/:id` | `"low_stock": false` |
| TC-03.6 | Libro con più autori | `GET /books/:id` | `authors` è array con N oggetti |

---

## US-04: Aggiornamento libro

**Come** gestore del catalogo,  
**voglio** aggiornare uno o più campi di un libro,  
**così che** possa correggere informazioni o aggiornare lo stock.

**Endpoint**: `PATCH /api/v1/books/:id`

### Criteri di accettazione (EARS)

**AC-04.1** — Aggiornamento parziale  
WHEN il gestore invia `PATCH /api/v1/books/:id` con un payload contenente solo alcuni campi,  
THEN il sistema aggiorna esclusivamente i campi presenti nel payload, lasciando invariati tutti gli altri, e restituisce `200 OK` con il libro aggiornato.

**AC-04.2** — Aggiornamento quantity: low_stock attivato  
WHEN il gestore invia `PATCH /api/v1/books/:id` con `quantity` aggiornata a un valore ≤ 5,  
THEN il sistema aggiorna il libro e la risposta contiene `"low_stock": true`.

**AC-04.3** — Quantità negativa  
WHEN il gestore invia `PATCH /api/v1/books/:id` con `quantity` negativa,  
THEN il sistema restituisce `400 Bad Request` con `VALIDATION_ERROR`.

**AC-04.4** — ISBN duplicato su altro libro  
WHEN il gestore invia `PATCH /api/v1/books/:id` con un `isbn` già assegnato a un libro diverso,  
THEN il sistema restituisce `409 Conflict` con `DUPLICATE_ISBN` e non modifica alcun record.

**AC-04.5** — Sostituzione completa author_ids  
WHEN il gestore invia `PATCH /api/v1/books/:id` con un array `author_ids`,  
THEN il sistema elimina tutte le associazioni autore precedenti e le sostituisce con i nuovi `author_ids`.

**AC-04.6** — Sostituzione completa genre_ids  
WHEN il gestore invia `PATCH /api/v1/books/:id` con un array `genre_ids`,  
THEN il sistema elimina tutte le associazioni genere precedenti e le sostituisce con i nuovi `genre_ids`.

**AC-04.7** — ID non esistente  
WHEN il gestore invia `PATCH /api/v1/books/:id` con un id che non esiste nel database,  
THEN il sistema restituisce `404 Not Found` con `NOT_FOUND`.

**AC-04.8** — Body vuoto  
WHEN il gestore invia `PATCH /api/v1/books/:id` con body `{}`,  
THEN il sistema restituisce `200 OK` con il libro invariato.

**AC-04.9** — Campi sconosciuti ignorati  
WHEN il gestore invia `PATCH /api/v1/books/:id` con campi non previsti nel modello,  
THEN il sistema ignora i campi sconosciuti e aggiorna solo i campi validi presenti.

### Test case principali

| ID | Scenario | Input | Expected |
|----|----------|-------|----------|
| TC-04.1 | Aggiornamento price | `{ "price": 12.50 }` | `200`, solo `price` aggiornato |
| TC-04.2 | Quantity → low stock | `{ "quantity": 3 }` | `200`, `"low_stock": true` |
| TC-04.3 | Quantity → non low stock | `{ "quantity": 10 }` | `200`, `"low_stock": false` |
| TC-04.4 | Quantity negativa | `{ "quantity": -1 }` | `400 VALIDATION_ERROR` |
| TC-04.5 | ISBN duplicato | `{ "isbn": "<isbn esistente>" }` | `409 DUPLICATE_ISBN` |
| TC-04.6 | Sostituzione author_ids | `{ "author_ids": [2, 3] }` | `200`, solo autori 2 e 3 associati |
| TC-04.7 | Sostituzione genre_ids | `{ "genre_ids": [1] }` | `200`, solo genere 1 associato |
| TC-04.8 | ID inesistente | `PATCH /books/99999` | `404 NOT_FOUND` |
| TC-04.9 | Body vuoto | `{}` | `200`, libro invariato |
| TC-04.10 | Campi sconosciuti | `{ "unknown_field": "x" }` | `200`, campi ignolati |

---

## US-05: Cancellazione libro

**Come** gestore del catalogo,  
**voglio** eliminare un libro dal catalogo,  
**così che** i titoli non più gestiti vengano rimossi.

**Endpoint**: `DELETE /api/v1/books/:id`

### Criteri di accettazione (EARS)

**AC-05.1** — Cancellazione con hard delete e pulizia relazioni  
WHEN il gestore invia `DELETE /api/v1/books/:id` con un id esistente,  
THEN il sistema elimina definitivamente il libro e tutte le sue associazioni in `book_authors` e `book_genres` (tramite CASCADE), e restituisce `204 No Content` senza body.

**AC-05.2** — ID non esistente  
WHEN il gestore invia `DELETE /api/v1/books/:id` con un id che non esiste nel database,  
THEN il sistema restituisce `404 Not Found` con `NOT_FOUND`.

**AC-05.3** — Verifica post-cancellazione  
AFTER il gestore ha cancellato un libro con successo,  
WHEN invia `GET /api/v1/books/:id` con lo stesso id,  
THEN il sistema restituisce `404 Not Found`.

### Test case principali

| ID | Scenario | Input | Expected |
|----|----------|-------|----------|
| TC-05.1 | Cancellazione libro esistente | `DELETE /books/1` | `204 No Content` |
| TC-05.2 | GET dopo cancellazione | `GET /books/1` post-delete | `404 NOT_FOUND` |
| TC-05.3 | Relazioni rimosse (book_authors) | Verifica DB dopo delete | Nessuna riga in `book_authors` per quel book_id |
| TC-05.4 | ID inesistente | `DELETE /books/99999` | `404 NOT_FOUND` |

---

## US-06: Gestione autori

**Come** gestore del catalogo,  
**voglio** gestire l'anagrafica degli autori (CRUD completo),  
**così che** possa associare correttamente gli autori ai libri.

**Endpoint**: `POST | GET | PATCH | DELETE /api/v1/authors`

### Criteri di accettazione (EARS)

#### Creazione

**AC-06.1** — Creazione con campi obbligatori  
WHEN il gestore invia `POST /api/v1/authors` con `first_name` e `last_name` validi (e opzionalmente `birth_date`, `biography`, `nationality`),  
THEN il sistema crea l'autore e restituisce `201 Created` con il corpo `{ "data": { ...autore con id generato } }`.

**AC-06.2** — Campi obbligatori mancanti  
WHEN il gestore invia `POST /api/v1/authors` senza `first_name` o senza `last_name`,  
THEN il sistema restituisce `400 Bad Request` con `VALIDATION_ERROR`.

#### Lista

**AC-06.3** — Lista paginata  
WHEN il gestore invia `GET /api/v1/authors`,  
THEN il sistema restituisce `200 OK` con envelope `{ "data": [...], "meta": { "page", "limit", "total" } }`.

#### Dettaglio

**AC-06.4** — Autore esistente  
WHEN il gestore invia `GET /api/v1/authors/:id` con un id esistente,  
THEN il sistema restituisce `200 OK` con i dati dell'autore.

**AC-06.5** — ID non esistente  
WHEN il gestore invia `GET /api/v1/authors/:id` con un id che non esiste,  
THEN il sistema restituisce `404 Not Found` con `NOT_FOUND`.

#### Aggiornamento

**AC-06.6** — Aggiornamento parziale  
WHEN il gestore invia `PATCH /api/v1/authors/:id` con un payload parziale,  
THEN il sistema aggiorna solo i campi presenti e restituisce `200 OK` con l'autore aggiornato.

#### Cancellazione

**AC-06.7** — Cancellazione autore senza libri  
WHEN il gestore invia `DELETE /api/v1/authors/:id` per un autore senza libri associati,  
THEN il sistema elimina l'autore e restituisce `204 No Content`.

**AC-06.8** — Cancellazione autore con libri associati  
WHEN il gestore invia `DELETE /api/v1/authors/:id` per un autore con almeno un libro associato,  
THEN il sistema restituisce `409 Conflict` con `HAS_DEPENDENCIES` e un messaggio che indica i libri associati, senza eliminare alcun record.

### Test case principali

| ID | Scenario | Input | Expected |
|----|----------|-------|----------|
| TC-06.1 | Creazione valida | `{ first_name, last_name }` | `201`, autore con id |
| TC-06.2 | Creazione con tutti i campi | Payload completo | `201 Created` |
| TC-06.3 | Manca first_name | `{ last_name: "Eco" }` | `400 VALIDATION_ERROR` |
| TC-06.4 | Manca last_name | `{ first_name: "Umberto" }` | `400 VALIDATION_ERROR` |
| TC-06.5 | Lista autori | `GET /authors` | `200`, envelope con meta |
| TC-06.6 | Dettaglio autore | `GET /authors/1` | `200`, dati autore |
| TC-06.7 | Autore inesistente | `GET /authors/99999` | `404 NOT_FOUND` |
| TC-06.8 | Aggiornamento biography | `PATCH /authors/1 { biography: "..." }` | `200`, solo biography aggiornata |
| TC-06.9 | DELETE senza dipendenze | Autore senza libri | `204 No Content` |
| TC-06.10 | DELETE con dipendenze | Autore con 2 libri | `409 HAS_DEPENDENCIES` |

---

## US-07: Gestione editori

**Come** gestore del catalogo,  
**voglio** gestire l'anagrafica degli editori (CRUD completo),  
**così che** possa associare correttamente gli editori ai libri.

**Endpoint**: `POST | GET | PATCH | DELETE /api/v1/publishers`

### Criteri di accettazione (EARS)

#### Creazione

**AC-07.1** — Creazione con name valido  
WHEN il gestore invia `POST /api/v1/publishers` con un campo `name` non vuoto,  
THEN il sistema crea l'editore e restituisce `201 Created` con `{ "data": { ...editore con id } }`.

**AC-07.2** — Campo name mancante  
WHEN il gestore invia `POST /api/v1/publishers` senza il campo `name`,  
THEN il sistema restituisce `400 Bad Request` con `VALIDATION_ERROR`.

#### Lista

**AC-07.3** — Lista paginata  
WHEN il gestore invia `GET /api/v1/publishers`,  
THEN il sistema restituisce `200 OK` con envelope `{ "data": [...], "meta": { "page", "limit", "total" } }`.

#### Dettaglio

**AC-07.4** — Editore esistente  
WHEN il gestore invia `GET /api/v1/publishers/:id` con un id esistente,  
THEN il sistema restituisce `200 OK` con i dati dell'editore.

#### Aggiornamento

**AC-07.5** — Aggiornamento name  
WHEN il gestore invia `PATCH /api/v1/publishers/:id` con `{ "name": "Nuovo Nome" }`,  
THEN il sistema aggiorna il nome e restituisce `200 OK` con l'editore aggiornato.

#### Cancellazione

**AC-07.6** — Cancellazione editore senza libri  
WHEN il gestore invia `DELETE /api/v1/publishers/:id` per un editore senza libri associati,  
THEN il sistema elimina l'editore e restituisce `204 No Content`.

**AC-07.7** — Cancellazione editore con libri associati  
WHEN il gestore invia `DELETE /api/v1/publishers/:id` per un editore con almeno un libro associato,  
THEN il sistema restituisce `409 Conflict` con `HAS_DEPENDENCIES` e non elimina alcun record.

### Test case principali

| ID | Scenario | Input | Expected |
|----|----------|-------|----------|
| TC-07.1 | Creazione valida | `{ "name": "Bompiani" }` | `201 Created` |
| TC-07.2 | Manca name | `{}` | `400 VALIDATION_ERROR` |
| TC-07.3 | Lista editori | `GET /publishers` | `200`, envelope con meta |
| TC-07.4 | Dettaglio editore | `GET /publishers/1` | `200`, dati editore |
| TC-07.5 | Editore inesistente | `GET /publishers/99999` | `404 NOT_FOUND` |
| TC-07.6 | Aggiornamento name | `PATCH /publishers/1 { name: "Nuovo" }` | `200`, name aggiornato |
| TC-07.7 | DELETE senza dipendenze | Editore senza libri | `204 No Content` |
| TC-07.8 | DELETE con dipendenze | Editore con libri | `409 HAS_DEPENDENCIES` |

---

## US-08: Consultazione generi

**Come** gestore del catalogo,  
**voglio** consultare la lista dei generi disponibili,  
**così che** possa assegnarli ai libri durante la creazione o l'aggiornamento.

**Endpoint**: `GET /api/v1/genres`, `GET /api/v1/genres/:id`

### Criteri di accettazione (EARS)

**AC-08.1** — Lista completa dei generi  
WHEN il gestore invia `GET /api/v1/genres`,  
THEN il sistema restituisce `200 OK` con `{ "data": [ ...tutti gli 11 generi predefiniti ] }` senza paginazione.

**AC-08.2** — Dettaglio genere  
WHEN il gestore invia `GET /api/v1/genres/:id` con un id esistente,  
THEN il sistema restituisce `200 OK` con `{ "data": { "id": N, "name": "..." } }`.

**AC-08.3** — Genere inesistente  
WHEN il gestore invia `GET /api/v1/genres/:id` con un id che non esiste,  
THEN il sistema restituisce `404 Not Found` con `NOT_FOUND`.

**AC-08.4** — Scrittura non permessa su /genres  
WHEN il gestore invia `POST`, `PATCH` o `DELETE` su qualsiasi URL sotto `/api/v1/genres`,  
THEN il sistema restituisce `405 Method Not Allowed`.

### Test case principali

| ID | Scenario | Input | Expected |
|----|----------|-------|----------|
| TC-08.1 | Lista generi | `GET /genres` | `200`, array con 11 generi, nessuna `meta` |
| TC-08.2 | Dettaglio genere | `GET /genres/1` | `200`, `{ "id": 1, "name": "Fiction" }` |
| TC-08.3 | Genere inesistente | `GET /genres/99` | `404 NOT_FOUND` |
| TC-08.4 | POST su /genres | `POST /genres` | `405 Method Not Allowed` |
| TC-08.5 | PATCH su /genres/:id | `PATCH /genres/1` | `405 Method Not Allowed` |
| TC-08.6 | DELETE su /genres/:id | `DELETE /genres/1` | `405 Method Not Allowed` |
| TC-08.7 | Contenuto lista | `GET /genres` | Contiene "Fiction", "Sci-Fi", "Horror", ecc. |

---

## US-09: Autenticazione API Key

**Come** amministratore di sistema,  
**voglio** proteggere l'API con API Key,  
**così che** solo le applicazioni autorizzate possano accedere al sistema.

**Meccanismo**: Header `X-API-Key`

### Criteri di accettazione (EARS)

**AC-09.1** — Richiesta autenticata correttamente  
WHEN un client invia qualsiasi richiesta all'API con un header `X-API-Key` contenente una chiave valida presente nel database,  
THEN il sistema elabora la richiesta normalmente.

**AC-09.2** — API Key mancante  
WHEN un client invia qualsiasi richiesta all'API senza l'header `X-API-Key`,  
THEN il sistema restituisce `401 Unauthorized` con `{ "error": { "code": "MISSING_API_KEY" } }` prima di processare qualsiasi logica di business.

**AC-09.3** — API Key non valida  
WHEN un client invia qualsiasi richiesta all'API con un header `X-API-Key` contenente una chiave non presente nel database,  
THEN il sistema restituisce `401 Unauthorized` con `{ "error": { "code": "INVALID_API_KEY" } }`.

**AC-09.4** — Multi-client indipendente  
WHEN più applicazioni client inviano richieste ciascuna con la propria API Key,  
THEN ogni chiave viene validata indipendentemente rispetto al database `api_keys`.

### Test case principali

| ID | Scenario | Input | Expected |
|----|----------|-------|----------|
| TC-09.1 | Richiesta con API Key valida | `X-API-Key: valid-key` | Risposta normale dalla route |
| TC-09.2 | Nessun header X-API-Key | Header assente | `401 MISSING_API_KEY` |
| TC-09.3 | API Key errata | `X-API-Key: wrong-key` | `401 INVALID_API_KEY` |
| TC-09.4 | Header vuoto | `X-API-Key: ` (stringa vuota) | `401 MISSING_API_KEY` o `INVALID_API_KEY` |
| TC-09.5 | Autenticazione si applica a tutti gli endpoint | GET, POST, PATCH, DELETE senza key | Tutti restituiscono `401` |

---

## US-10: Rate Limiting

**Come** amministratore di sistema,  
**voglio** limitare il numero di richieste per API Key,  
**così che** il sistema sia protetto da abusi e sovraccarichi.

**Soglia**: 100 richieste/minuto per API Key.

### Criteri di accettazione (EARS)

**AC-10.1** — Richieste entro la soglia  
WHEN un client ha effettuato meno di 100 richieste nell'ultimo minuto e invia una nuova richiesta,  
THEN il sistema elabora la richiesta normalmente e la risposta contiene gli header `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `X-RateLimit-Reset`.

**AC-10.2** — Soglia raggiunta  
WHEN un client ha raggiunto esattamente 100 richieste nell'ultimo minuto e invia un'ulteriore richiesta,  
THEN il sistema restituisce `429 Too Many Requests` con l'header `Retry-After` (secondi rimanenti alla fine della finestra) e `{ "error": { "code": "RATE_LIMIT_EXCEEDED" } }`.

**AC-10.3** — Header rate limit sempre presenti  
WHEN un client riceve qualsiasi risposta `2xx` dall'API,  
THEN la risposta contiene gli header:
- `X-RateLimit-Limit: 100`
- `X-RateLimit-Remaining: N` (conteggio richieste rimanenti)
- `X-RateLimit-Reset: <timestamp Unix>` (quando si azzera la finestra)

**AC-10.4** — Rate limit per API Key indipendente  
WHEN due client con API Key distinte inviano richieste,  
THEN il contatore di rate limit di ciascun client è indipendente dall'altro.

### Test case principali

| ID | Scenario | Input | Expected |
|----|----------|-------|----------|
| TC-10.1 | Prima richiesta | 1 richiesta | `200`, header `X-RateLimit-Remaining: 99` |
| TC-10.2 | Richiesta 100/100 | 100ª richiesta | `200`, `X-RateLimit-Remaining: 0` |
| TC-10.3 | Richiesta 101/100 | 101ª richiesta | `429 RATE_LIMIT_EXCEEDED`, header `Retry-After` presente |
| TC-10.4 | Header sempre presenti | Qualsiasi richiesta 2xx | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` nelle response |
| TC-10.5 | Rate limit per-client | 2 client distinti | Contatori indipendenti per ogni API Key |

---

## Riepilogo copertura requisiti

| User Story | RF di riferimento | Endpoint |
|------------|-------------------|----------|
| US-01 | RF-01.1 | POST /api/v1/books |
| US-02 | RF-01.2 | GET /api/v1/books |
| US-03 | RF-01.3 | GET /api/v1/books/:id |
| US-04 | RF-01.4 | PATCH /api/v1/books/:id |
| US-05 | RF-01.5 | DELETE /api/v1/books/:id |
| US-06 | RF-02.1 | /api/v1/authors |
| US-07 | RF-03.1 | /api/v1/publishers |
| US-08 | RF-04 | /api/v1/genres |
| US-09 | RF-05 | Middleware globale |
| US-10 | RF-06 | Middleware globale |
