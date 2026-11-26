# Сөзқала / Словоград: what it is, in plain words

## The idea

Сөзқала (in Russian, Словоград, "word city") is a website for **Russian language and literature lessons, grades 5–11**.

Instead of a grade book, every student gets an empty **city** with 8 building plots. Each building is one part of the course. When a student does tasks, the score (out of 10) **builds** that building: first a foundation, then walls, and at the top level a finished building with lights, a fountain and trees. The building never gets worse: a weaker try doesn't take the level away.

The goal is to build the whole city. When the required work is done, the student gets a **certificate** («Главный архитектор Словограда») as a PDF with a QR code.

The site works in **Kazakh and Russian** (switch at the top right: ҚАЗ / РУС), on computers, tablets and phones.

## The 8 buildings

| Building | What it trains |
|---|---|
| Дворец грамматики | spelling and grammar |
| Мост предложений | syntax and punctuation |
| Библиотека знаний | reading and text analysis |
| Театр героев | literary characters and their actions |
| Башня слов | vocabulary and idioms |
| Академия творчества | essays and creative writing |
| Парк поэзии | poems and figures of speech |
| Ратуша знаний | final tasks |

The score decides how far each building is built: **1–3** → foundation, **4–5** → small house, **6–7** → full building, **8–9** → beautiful building, **10** → best level.

## Who uses it

**Students**
- see their city and tap a building to see its tasks;
- do tasks: multiple choice, matching, fill in the gaps, word order, fix the mistakes, punctuation, text analysis, "guess the character", essays, creative work and **spoken (audio) answers**;
- get points, building materials and stars, and spend materials on decorations for the city (trees, benches, lamps, a fountain);
- see their history (a score chart) and download their certificate.

**Teachers**
- create classes (each with a grade, 5–11) and student accounts, or give students a class code to join on their own;
- write tasks of 12 types, or use the **40 ready-made variants** from the documents;
- assign tasks to a class or to one student. A grade-5 student sees only grade-5 tasks;
- check essays and audio answers with a rubric, and see class analytics (who is behind, which topics are weak);
- set the certificate rules for their class.

**Parents**
- see their own child's city, results, weak topics and certificate;
- get notifications (a new building, the certificate, …);
- **can only look**: they can't do tasks or change grades.

**Admin**
- creates teacher and parent accounts, schools and settings;
- sees logs and makes backups;
- can delete an account with all its data, when a family asks for it (personal-data law).

Most tasks are graded automatically the moment the student submits. Essays, creative work and audio answers wait for the teacher, and the building updates as soon as the teacher grades them.

## Where it runs

| Version | Address | Use it for |
|---|---|---|
| **Demo** | https://sozqala.vercel.app | showing the platform. Test data only: the servers are outside Kazakhstan, so no real student data |
| **Your laptop** | http://localhost:3000 after `npm run dev` | trying changes |
| **School network, offline** | http://SERVER-IP:3000 | lessons without internet: [deploy-offline.md](deploy-offline.md) |
| **PS Cloud (Kazakhstan)** | e.g. https://sozqala.kz | the real school site, reachable from home: [deploy-ps-cloud.md](deploy-ps-cloud.md) |

## Logins and passwords

### Demo accounts (on the demo site and on a fresh laptop install)

| Role | Login | Password | Who it is |
|---|---|---|---|
| Admin | `admin` | `admin12345` | the whole platform |
| Teacher | `teacher` | `demo12345` | Гүлмира Ахметова, class 7«Ә» (join code `SOZ7A1`). The 39 imported tasks also belong to this account |
| Student | `aruzhan` | `demo12345` | half-built city, an essay waiting for the teacher |
| Student | `alina` | `demo12345` | the best in class, one task short of the certificate |
| Student | `damir` | `demo12345` | creative work waiting for review |
| Student | `madina` | `demo12345` | just started |
| Student | `timur` | `demo12345` | empty city ("first day" view) |
| Parent | `parent` | `demo12345` | Аружан's mother (sees only Аружан) |
| Parent | `parent2` | `demo12345` | Дамир's father (sees only Дамир) |

On the laptop (`npm run dev`), the login page also has one-click buttons for these accounts.

On the **demo site**, `admin` still has `admin12345` unless someone changed it at **My account**. Since everyone can read these passwords, change the admin one there. The site also has the class **«5 A»** (no students yet) and the hand-entered task «Дворец Грамматики 5 класс».

### Real installations (school network or PS Cloud)

- There are **no demo accounts**: the guides install with `SEED_DEMO=false`.
- The only account at first is **`admin`**, with the password you choose during installation. Keep it somewhere safe; nobody can recover it.
- The admin creates teachers, and teachers create students and parents. Each new password is **shown once**: write it down or give it to the person straight away.
- Everyone can change their own password at **My account** (click your name at the top).
- **Forgot a password?** A teacher resets students' passwords, and the admin resets anyone's. After **5 wrong passwords** that login is blocked for 15 minutes.

## Ready-made tasks

40 tasks were built from the documents in `docs/` (01–04):

| Building | Variants | Questions per variant |
|---|---|---|
| Дворец грамматики | 10 | 18, multiple choice, 15 min |
| Библиотека героев → Библиотека знаний | 10 | 12, multiple choice, 10 min |
| Мост предложений | 10 | 12, multiple choice, 10 min |
| Театр персонажей → Театр героев | 10 | 15 written answers, checked by the teacher |

Each variant has its grade (5–10), so it can only go to classes of that grade. On a new server they are loaded with one command (see the deploy guides), then the teacher assigns them. Details: [content/task-bank/README.md](../content/task-bank/README.md).

Document 05 (building award certificates such as «Мастер грамматики») describes a feature that isn't built yet.

## Personal data, in short

- Real student data must be stored **in Kazakhstan**. Use the school network or PS Cloud, never the Vercel demo.
- Registering requires the consent checkbox, and the site has a **Personal data** page (link on the login page).
- The certificate check page (`/verify/…`) shows only that the certificate is valid, its level and its date, never the name.
- Parents see only their own children, and teachers only their own classes.

Full checklist: [security.md](security.md).

## More documentation

- Step-by-step user guides: [Kazakh](user-guide.kk.md) · [Russian](user-guide.ru.md)
- Install offline at school: [deploy-offline.md](deploy-offline.md)
- Install on PS Cloud: [deploy-ps-cloud.md](deploy-ps-cloud.md)
- Demo on Vercel: [deploy-vercel.md](deploy-vercel.md)
- For developers: [README](../README.md), [data-model.md](data-model.md)
