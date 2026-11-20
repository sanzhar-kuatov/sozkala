# 03 · UX: sitemap, flows, wireframes

High-fidelity mockups of the key screens are in [`design/preview.html`](../../design/preview.html) → section 07.
The wireframes below cover every screen needed for the MVP (spec §12). Routes are prefixed with the locale (`/kk/…`, `/ru/…`).

## 1. Sitemap

```
Public       /                     landing (what is Сөзқала, log in)
             /login                login (all roles)
             /join/[code]          student joins a class by invite code
             /verify/[code]        certificate check (no personal data)

Student      /student              MY CITY (home)
             /student/building/[key]          building: tasks list, level history
             /student/task/[id]               task player
             /student/task/[id]/result/[att]  result: score, mistakes, explanations
             /student/rewards                 points, materials, stars, badges, decorations
             /student/history                 learning history + progress chart
             /student/certificate             certificate status / download

Teacher      /teacher                         dashboard (class switcher)
             /teacher/classes, /classes/[id]  students, invite codes, parent links
             /teacher/topics                  topics
             /teacher/tasks, /tasks/new, /tasks/[id]   task bank + builder
             /teacher/buildings               per-class building config (order, required, scoring mode)
             /teacher/review                  manual review queue (essay, creative, audio)
             /teacher/students/[id]           one student: their city, per-topic results, mistakes, growth
             /teacher/analytics               class analytics
             /teacher/certificates            thresholds and issued certificates

Parent       /parent                          child overview (switch child if more than one)
             /parent/child/[id]/city          read-only city + building development history
             /parent/child/[id]/results       results, difficult topics
             /parent/notifications            notification feed
             /parent/child/[id]/certificate   view / download

Admin        /admin                           health overview
             /admin/users, /schools           users, roles, schools
             /admin/buildings                 building catalogue, levels, rewards, decorations
             /admin/certificates              templates, default tiers
             /admin/settings                  platform settings
             /admin/logs, /admin/backups      audit + error logs, backups
```

## 2. Main flow (spec §13)

```
login ─▶ empty city (8 lots with ghosts) ─▶ tap "Грамматика сарайы"
      ─▶ building sheet: tasks (required ●, optional ○), deadline, attempts left
      ─▶ task player ─▶ submit
            ├─ auto-graded  ─▶ result 7/10 ─▶ city: build animation → L3
            └─ manual task  ─▶ "Sent to teacher" ─▶ (teacher grades) ─▶ notification ─▶ city updates
      ─▶ parent sees "Балаңыз жаңа ғимарат салды!", teacher sees the result in analytics
      ─▶ retake / extra task ─▶ 9/10 ─▶ L4 (never goes down)
      ─▶ all required tasks + core buildings ─▶ certificate generated ─▶ PDF + QR ─▶ /verify
```

## 3. Student

### 3.1 My city: desktop

```
┌──────────────────────────────────────────────────────────────────────────────┐
│▌«Аружан-қала» ✎   7«Ә»                    🧠 1 240  ⭐ 14  🧱 86  🔔2  (kk|ru) 👤│
├───────────┬──────────────────────────────────────────────┬───────────────────┤
│ 🏙 Қалам   │                                              │ Грамматика сарайы │
│ 🏆 Марапат │            [ ISOMETRIC CITY 3×3 ]            │ [ building L3 ]   │
│ 📈 Тарих   │                                              │ ● 3 Толық ғимарат │
│ 🎓 Сертиф. │                                              │ Best 7/10 · 2/4   │
│           │   43% ▓▓▓▓▓▓░░░░░░  Қала дайын             │ [▶ Тапсырмалар]   │
│           │                                     [+][−]   │ next: «Н/НН» ⏰2д │
└───────────┴──────────────────────────────────────────────┴───────────────────┘
```

### 3.2 My city: phone

```
┌──────────────────────────┐
│ «Аружан-қала»   🧠1240 🔔│
│ ▓▓▓▓▓▓░░░░░ 43%          │
│                          │
│     [ CITY, pinch/drag ] │
│                          │
├──────────────────────────┤  ← bottom sheet on tap
│ Грамматика сарайы  ● L3  │
│ [▶ Тапсырмаларды ашу]    │
├──────────────────────────┤
│ 🏙   🏆   📈   🎓   👤    │  ← bottom tab bar
└──────────────────────────┘
```

### 3.3 Building page

```
┌──────────────────────────────────────────────┐
│ ← Грамматика сарайы      Емле және грамматика│
│ [ building L3, big ]   L1 ✓ L2 ✓ L3 ● L4 ○ L5 ○│
│ Scoring: Ең үздік нәтиже · Best 7/10         │
├──────────────────────────────────────────────┤
│ ● Н и НН в прилагательных   ✓ 7/10  [Retake] │
│ ● Правописание приставок    ○ new   ⏰ 20.11 │
│ ○ Доп.: Не с причастиями    ○ new            │
│ ● Диктант (аудио)           ⏳ on review     │
├──────────────────────────────────────────────┤
│ History: 5 → 7 (L2 → L3) · 12.11, 15.11      │
└──────────────────────────────────────────────┘
```

### 3.4 Task player (one screen per question)

```
┌──────────────────────────┐
│ ✕  Грамматика сарайы ⏱4:12│
│ ■■■▢▢▢   Вопрос 3/6       │
│ Выберите слова, в которых│
│ пишется НН.              │
│ [✓] деревя..ый           │
│ [ ] серебря..ый          │
│ [✓] стекля..ый           │
│ [ ] кожа..ый             │
│ [ Тексеру ]               │
└──────────────────────────┘
```

Per-type input:
- **single / multi:** radio or checkbox cards.
- **matching:** two columns with tap-to-pair, or drag and drop.
- **fill gaps:** inline inputs, or chips from a word bank.
- **word order:** draggable chips.
- **error correction:** tap a word, then edit it.
- **punctuation:** tap the gaps between words and pick `, . — : ;`.
- **text/quote analysis and identify the character:** a passage above the question (choice or short answer).
- **essay / creative:** a textarea with a word counter and autosave, plus criteria shown.
- **audio:** record, play back, re-record, submit (≤ 3 min).

Timer and attempts-left are shown in the header. Answers are autosaved and survive a reload.

### 3.5 Result

```
┌──────────────────────────┐
│   [ building grows ]     │
│      +1 деңгей!          │
│ (7/10)  Толық ғимарат    │
│ Mistakes & explanations  │
│ ✗ серебряный — суф. -ЯН- │
│ ✓ деревянный — исключение│
│ [↻ Retake]   [🗺 To city] │
└──────────────────────────┘
```

Manual tasks show "Мұғалімге жіберілді" with an hourglass instead of a score. Rewards earned (points, materials, stars, badge) are shown as counters ticking up.

### 3.6 Rewards · history · certificate

- **Rewards:** counters, a grid of badges (locked/unlocked with a progress hint), and a decorations inventory with a "place in city" button.
- **History:** timeline of attempts (date, task, score, level change) and a progress line chart.
- **Certificate:** a checklist of requirements (required tasks x/y, core buildings x/8, current tier), then a "Download PDF" button once it is issued.

## 4. Teacher

### 4.1 Dashboard

```
┌──────────────────────────────────────────────────────────────────────────┐
│▌Сынып: 7«Ә» ▾ · 26 оқушы                           [+ Жаңа тапсырма]     │
├──────────┬──────────┬──────────────┬──────────────┬──────────────────────┤
│ 24 tasks │ 7.4 avg  │ 5 to review  │ 132 buildings│ 61% avg completion   │
├──────────┴──────────┴───────────┬──┴──────────────┴──────────────────────┤
│ Results by topic (bars)         │ Review queue                            │
│ Н/НН ▓▓▓▓▓░░░ 5.2               │ Аружан К. · Эссе        [Бағалау]       │
│ Причастия ▓▓▓▓▓▓▓░ 7.1          │ Дамир С. · Аудио        [Бағалау]       │
├─────────────────────────────────┴─────────────────────────────────────────┤
│ Progress chart (class avg per week) · Students table: name | city% | avg | │
│ last active | attention flag                                              │
└───────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Task builder (`/teacher/tasks/new`)

```
Step 1 Basics     title, topic ▾, building ▾, type ▾ (12 types), difficulty ★★☆
Step 2 Content    instruction (rich text), media (text/image/audio/video upload)
                  type-specific editor: options + correct ✓ / pairs / gaps [__] / order / ...
Step 3 Checking   auto: answer key + partial credit rule  |  manual: criteria rubric (max 10)
                  explanation shown after the attempt
Step 4 Limits     time limit, max attempts, deadline, required ●/optional ○
Step 5 Assign     whole class | selected students · [Preview as student] [Save draft] [Publish]
```

### 4.3 Building config per class

A table of 8 buildings with: unlock order (drag), required toggle, unlock rule (always / after building X ≥ L2), and scoring mode (Ең үздік · Орташа · Міндетті тапсырмалар бойынша).

### 4.4 Review screen

```
┌─────────────────────────────────────┬───────────────────────────┐
│ Аружан К. · Эссе «Мой любимый герой»│ Criteria (rubric)          │
│ [student text / audio player]       │ Content      0–4  [ 3 ]    │
│ inline comments (select → comment)  │ Literacy     0–3  [ 2 ]    │
│                                     │ Structure    0–3  [ 3 ]    │
│                                     │ Total 8/10 → L4 preview   │
│                                     │ Feedback ________________  │
│                                     │ [Return for redo] [Grade ✓]│
└─────────────────────────────────────┴───────────────────────────┘
```

### 4.5 Student detail

Their city (read-only), per-building level history, per-topic results, a list of frequent mistakes, a growth chart, and actions: **assign an individual task** and **allow a retake**.

## 5. Parent (read-only everywhere)

```
┌──────────────────────────┐
│▌Балам: Аружан К., 7«Ә» ▾ │
│ [ child's city ]         │
│ 7.6 avg   38 done   62%  │
│ Difficult topics: Н/НН…  │
│ Notifications (5 types)  │
│ Certificate [View][PDF]  │
│ 🔒 Read-only             │
└──────────────────────────┘
```

There are no submit or edit controls anywhere in the parent UI, and the server rejects writes from the parent role regardless (spec §14.7).

## 6. Admin

A standard data-table UI with a slate stripe:
- Users: search, role filter, reset password, link parent↔student.
- Schools.
- Building catalogue: names kk/ru, order, art level thresholds.
- Rewards and badges: rules.
- Decorations.
- Certificate template and default tiers.
- Settings.
- Audit log: who changed what, with filters.
- Error log.
- Backups: list, create now, download.

## 7. Certificate & verify

- **PDF:** A4 landscape. It shows the title «СӨЗҚАЛАНЫҢ БАС СӘУЛЕТШІСІ», the full name, class, issue date, final score, tier seal (bronze/silver/gold/platinum), a mini skyline, the serial `SZ-YYYY-NNNNNN`, and a QR code linking to `/verify/{code}`.
- **Verify page:** shows only *valid/invalid*, serial, tier, and issue date. No name or school (spec §7, §11).

## 8. States checklist (every screen)

Every screen handles: loading skeleton · empty state (with a friendly illustration, e.g. the L0 ghost lot) · error with retry · offline banner (the task player keeps answers locally) · no permission (a 403 page with a link back to the user's own cabinet).
