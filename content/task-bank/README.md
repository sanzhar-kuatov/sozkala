# Task bank

These files hold the ready-made tasks built from the documents in `docs/`. There is **one task per variant**.

| File | Document | Building | Tasks | Type |
|---|---|---|---|---|
| `01-grammar.json` | 01 Дворец грамматики | grammar | 10 × 18 questions | single choice |
| `02-library.json` | 02 Библиотека героев | library | 10 × 12 | single choice |
| `03-bridge.json` | 03 Мост предложений | bridge | 10 × 12 | single choice |
| `04-theatre.json` | 04 Театр персонажей | theatre | 10 × 15 | essay, graded by the teacher (rubric 4 + 3 + 2 + 1) |

Each task carries its grade (5–10) from the document, a topic (the variant's theme or the literary work), a difficulty (grades 5–6 → 1, 7–8 → 2, 9–10 → 3), a time limit (15 min for 18 questions, 10 min for 12, none for essays) and its number of attempts (2; 1 for essays).

## Rebuild after editing a document

```
npm run tasks:build        # python scripts/task-bank/build-bank.py
```

Wrong options come from rules plus the hand-written lists in `scripts/task-bank/build-bank.py`. After a rebuild, read through the JSON before importing.

## Import

```
npm run tasks:import -- --remote --except grammar-v1 --dry-run   # check first
npm run tasks:import -- --remote --except grammar-v1             # live site (.env.turso)
npm run tasks:import                                              # local database (.env)
```

- **Options:** `--author <login>` (default `teacher`), `--only <keys>`, `--except <keys>`, `--dry-run`.
- **Re-running:** tasks whose title already exists for that author are skipped, so the import is safe to run again. Changing an already-imported task is done in the editor, or by deleting the task and importing again.
- **Validation:** every task is checked with the same rules as the task editor.
- **After import:** tasks arrive **published but not assigned**. Assign them to classes of the same grade on the task page.

## Corrections made to the source documents

- **Prompts that gave the answer away** now show the spot to decide instead (e.g. «написа(н/нн)ый», «(в)начале подумай», «Улыбаясь он вошёл»). This affects grammar V3 q14, V4 q17–18, V5 q7–10 and q15–16, V6 q5–6, q8–12 and q14, V7 q9 and q17, and V8 q9–11.
- **Asyndetic sentences (БСП):** wrong options are only colon / dash / no sign. A comma is left out on purpose, because it can be defended as correct for a sequence of events.
- **Teacher guide for 04:** the document's «Ориентиры для учителя» are stored as the task explanation, so students see them only after submitting.
