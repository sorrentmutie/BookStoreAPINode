---
name: task-breakdown
description: >
  Scomponi user stories in task atomici e testabili.
  Usa per passare da requisiti a piano di implementazione.
---
 
# Task Breakdown Skill
 
## Input
Leggi le user stories da docs/requirements/user-stories.md
 
## Regole
- Ogni task DEVE essere atomico (completabile in un commit)
- Ogni task DEVE essere testabile (con criterio pass/fail chiaro)
- Ogni task DEVE essere stimabile (< 30 min di lavoro Claude)
- Identifica dipendenze tra task
- Ordina: modello → repository → validazione → route → test
 
## Output: docs/tasks/TASKS.md
```markdown
# Task List - BookStore API
 
## Fase 1: Modello e Infrastruttura
- [ ] T001: Creare modulo database (setup SQLite in-memory)
  - Dipendenze: nessuna
  - Test: unit test su connessione e schema creation
  - Stima: 10 min
```
