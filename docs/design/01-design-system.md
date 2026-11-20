# 01 · Design system — СӨЗҚАЛА / СЛОВОГРАД

Stage 0 deliverable. Source of truth for tokens: [`design/tokens.css`](../../design/tokens.css).
Live reference: open [`design/preview.html`](../../design/preview.html) in a browser.

## 1. Product feel

| Principle | Means in practice |
|---|---|
| **The result is the city** | Every score is visible as a building change. No score lives only as a number. |
| **Nothing ever breaks** | Low scores never downgrade or "damage" a building. Errors use soft coral, not alarm red. No fail sounds/animations. |
| **Game look, study clarity** | Playful chrome (chunky buttons, iso city, badges) around calm, high-contrast, large task text. |
| **Phone first** | Designed at 360 px, scaled up to tablet (768) and desktop (1280). Touch targets ≥ 44 px. |
| **Bilingual by default** | Interface kk (default) + ru; learning content is Russian. Brand switches: СӨЗҚАЛА ↔ СЛОВОГРАД. |

## 2. Colour

Brand pair = **Sky `#00AFCA`** (primary) + **Sun `#FFC72C`** (accent): the Kazakhstan-flag hues, bright and friendly.

| Role | Token | Use |
|---|---|---|
| Primary | `--color-primary` (sky-500) | main actions, links, focus states, student role |
| Accent | `--color-accent` (sun-500) | rewards, stars, gold trim, "level up" |
| Success | `--color-success` (grass-500) | correct answers, auto-checked task chips |
| Danger | `--color-danger` (coral-500) | mistakes, destructive actions (soft coral) |
| Info | `--color-info` (violet-500) | achievements, perfect 10, manual-review chips |
| Text | `--color-text` ink-900 / muted ink-500 | |
| Background | `--color-bg` paper `#FFFBF3`, surface white, alt cream | warm "paper" feel |

**Score scale → colour** (`--score-0` … `--score-5`) is used everywhere a score or level is shown (pills, rings, bars, heat-maps):
L0 grey · L1 coral · L2 orange · L3 sun · L4 grass · L5 violet.

**Roles:** student sky, teacher green `#2EAD6B`, parent orange `#FF8A3D`, admin slate `#5B6B82`. Shown as a header stripe and chips, so a user always knows which cabinet they're in.

**Certificate tiers:** bronze `#CD7F32`, silver `#A9B4C2`, gold `#F2B705`, platinum `#7FC8DC`.

Contrast: body text ink-900 on paper = 14.9:1. White on sky-500 is used only for ≥ 15 px bold button labels. Gold (sun-500) surfaces always carry ink-900 text, never white.

## 3. Typography

- **Rubik** (500–800): headings, numbers, scores, brand.
- **Nunito** (400–800): UI and body text.
- Both ship the `cyrillic-ext` subset, so all Kazakh letters render (Ә Ғ Қ Ң Ө Ұ Ү Һ І).

| Token | px | Use |
|---|---|---|
| `--text-4xl` | 48 | hero / certificate title |
| `--text-2xl` | 28 | page titles |
| `--text-xl` | 22 | card titles, building name |
| `--text-lg` | 18 | **task question text (minimum)** |
| `--text-base` | 16 | body, inputs (16 px prevents iOS zoom) |
| `--text-sm` / `xs` | 14 / 12 | meta, captions, labels (uppercase, letter-spacing .08em) |

Rules: line-height 1.5 for reading text; ≤ 70 characters per line in tasks; scores always in Rubik 800.

## 4. Shape, depth, spacing

- Radius: 8 / 14 / 20 / 28 / pill. Cards use 20, buttons 14, chips pill.
- **Chunky depth:** primary buttons have a 4 px solid bottom edge in a darker shade (`--edge-depth`), and they "press" on `:active`. This is the main game-like cue in the chrome.
- Cards: white, 1 px warm border `--sz-line`, soft shadow `--shadow-card`.
- Spacing: 4 px grid (`--space-*`). Page gutter 16 px on phone, 24 px or more on desktop. Max content width 1240 px.

## 5. Components (spec, implemented in Stage 1 with shadcn/ui + Tailwind)

| Component | Variants / notes |
|---|---|
| **Button** | primary · accent · success · danger · ghost; sizes sm 36 / md 44 / lg 56; icon + label; disabled = grey without the edge colour |
| **Field** | label above the input, hint below; error = coral border + bold hint; focus ring sky-100 4 px |
| **Chip** | role chips, task-type chips (green = auto-checked, violet = manual review) |
| **Level pill** | numbered dot coloured by level + level name (`L3 · Толық ғимарат`) |
| **Score ring** | conic ring 0–10 coloured by level; sizes 112 / 88 / 64 |
| **Progress bar** | striped sun (city completion) or sky (task progress) |
| **Counter** | resource chips: knowledge points (brain), materials (brick), stars |
| **Badge medal** | round medal with icon; locked state is grey with a lock icon |
| **Notification** | icon tile + text + time; unread = sky tint and a dot |
| **Tabs** | pill tabs; selected = ink-900 filled |
| **Toast** | dark pill with an accent icon, used for "level up" and "saved" |
| **Device-safe layouts** | split views stack below 1000 px; tables scroll horizontally |

Icons: **lucide** (`lucide-react` in the app), 2 px stroke, sizes 16/18/20.

## 6. Motion

| Moment | Animation | Duration |
|---|---|---|
| Building level up | the new state grows from the ground (`scaleY .04 → 1.07 → 1`, bounce) with dust puffs | 900 ms |
| "+1 level" | the badge pops in, floats, and fades | 1.6 s |
| Plot hover/focus | lifts 6 px with a drop shadow | 250 ms |
| Button press | moves down 4 px as its bottom edge collapses | 150 ms |
| Ambient (L4–L5) | flags wave, fountain spray, twinkling sparkles, lit windows pulse | loops |

The build animation plays **only when the level actually increases**, never on plain page load. `prefers-reduced-motion` turns off all of the above (see `tokens.css`).

## 7. Responsive

| Breakpoint | Layout |
|---|---|
| < 640 (phone) | single column; the city fills the width; the building panel becomes a bottom sheet; bottom tab bar for navigation |
| 640–1023 (tablet) | city + collapsible side panel; 2-column grids |
| ≥ 1024 (desktop) | side navigation, city + 320 px info panel, 4-column stat grids |

City canvas: pinch/drag on touch, wheel and +/- buttons on desktop. Zoom is clamped 1×–3×. Plots are keyboard-focusable (Tab, then Enter).

## 8. Language

- `next-intl` with `kk` (default) and `ru`; all UI strings live in `messages/{kk,ru}.json`.
- Building names, achievement names, and notification texts are fixed bilingual pairs (see the building catalogue in [02](02-isometric-art-spec.md)).
- Task content, explanations, and answers are authored in Russian by teachers and are never translated by the UI.
