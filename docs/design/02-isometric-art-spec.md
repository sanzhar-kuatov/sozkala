# 02 · Isometric art spec — city & buildings

Engine: [`design/iso/iso-engine.js`](../../design/iso/iso-engine.js) (primitives) and
[`design/iso/buildings.js`](../../design/iso/buildings.js) (8 blueprints, level pipeline, city).
Both are dependency-free and return SVG strings. Since Stage 4 the app uses the TypeScript port in [`components/city/engine/`](../../components/city/engine/). Its output is byte-identical to the prototype (`tests/city-engine.test.ts`), and the city name is XML-escaped. **When changing art, edit the TS files**, then update the prototype too if `design/preview.html` should keep matching (the test will tell you).

## 1. Projection

| Parameter | Value |
|---|---|
| Projection | 2:1 dimetric ("pixel-art isometric") |
| Tile | 64 × 32 px per grid unit |
| Height unit | 34 px per z unit |
| Formula | `sx = (x − y)·32`, `sy = (x + y)·16 − z·34` |
| Light | from the top-left: top face = base +22 % white; +y ("left") face = base; +x ("right") face = base +20 % ink |
| Outline | 1 px `rgba(30,42,59,.30)`, round joins (soft cartoon edge) |
| Draw order | painter's algorithm: ascending `x + y`, then ascending `z` |

Details on walls (windows, doors, clocks, letters) are drawn in **face-local units** via `onLeft()` / `onRight()`, which apply an affine matrix. Authors place a window as `win(u, v, w, h)` on a flat wall, and it lands correctly in isometric space.

## 2. Plot

- Each building owns a **3 × 3 plot** with a raised ground slab (top at z = 0.2).
- The building footprint is roughly 2 × 2 in the middle. The rim holds decorations (trees, lamps, fountain).
- Single-plot viewBox: `-104 -150 208 262`.

## 3. Levels (applies to all 8 buildings)

| Level | Score | What is drawn |
|---|---|---|
| **L0** empty lot | no graded attempt | pale grass, dashed footprint, corner survey flags, a "+" sign, and a 16 % opacity **ghost** of the L3 building (shows the goal) |
| **L1** foundation & frame | 1–3 | concrete slab, timber scaffold with planks, a yellow crane with a hanging crate, bricks and crates |
| **L2** small building | 4–5 | a compact, simple version: plain windows and a basic roof |
| **L3** full building | 6–7 | full-size building with mullioned windows, a door, and a paved path to the door; one tree |
| **L4** decorated | 8–9 | arched windows, gold trim, flags, turrets/emblems, back trees, flowers, lamps, a bench |
| **L5** masterpiece | 10 | lit warm windows (pulsing), glowing lamps, a fountain, extra greenery, twinkling sparkles; building-specific lights (spotlights, beacon, string lights) |

`levelForScore(s)`: `s ≥ 10 → 5`, `≥ 8 → 4`, `≥ 6 → 3`, `≥ 4 → 2`, `≥ 1 → 1`, else `0`.
Fractional aggregate scores (the average mode) must reach the integer threshold: 7.9 → L3.

**Rule:** displayed level = `max(previous level, levelForScore(aggregate))`, so it **never decreases**. The full attempt history is stored separately.

## 4. Building catalogue

| Key | kk | ru | Area | Silhouette (L3) | L4–L5 signature | Palette |
|---|---|---|---|---|---|---|
| `grammar` | Грамматика сарайы | Дворец грамматики | Емле және грамматика | palace body + central domed tower | two corner turrets with cone roofs and flags, gold spire | lavender `#CDBDFF` / violet `#6D4AE8` / gold |
| `bridge` | Сөйлемдер көпірі | Мост предложений | Синтаксис және тыныс белгілері | stone arch bridge over a canal crossing the plot | lamps on the parapets, bunting → string lights, sailboat | stone `#A9BCD0`, water `#4FC3F7` |
| `library` | Білім кітапханасы | Библиотека знаний | Оқу және мәтінді талдау | classical temple: podium, 4 columns, pediment | gold band, open-book emblem, front steps, potted shrubs | sand `#F2D3A8` / terracotta `#C9603F` |
| `theatre` | Кейіпкерлер театры | Театр героев | Әдеби кейіпкерлер | round drum + dome, portal with a red curtain | comedy/tragedy masks, marquee bulbs, posters; L5 spotlights | coral `#FFB4A8` / magenta `#C2185B` |
| `tower` | Сөздер мұнарасы | Башня слов | Лексика және фразеология | tall tower: base, shaft, balcony, lantern room, pyramid roof | "СЛОВО" letter tiles on the shaft, gold ball + flag; L5 beacon | apricot `#FFC37A` / blue `#1E88E5` |
| `academy` | Шығармашылық академиясы | Академия творчества | Эссе және шығармашылық жұмыс | modern L-shape: tall block + glass wing | multicolour window frames, rooftop garden, giant pencil; L5 string lights | mint `#A8E6C9` / green `#2E9E6E` |
| `park` | Поэзия саябағы | Парк поэзии | Өлең және көркемдегіш құралдар | paths cross + white rotunda with a pink dome | lily pond, poet bust on a pedestal, rose arch; L5 fireflies | rose `#F06292`, white |
| `townhall` | Білім ратушасы | Ратуша знаний | Қорытынды тапсырмалар | hall with a gable roof + front clock tower | "қошқар мүйіз" ornament band, roof flags, gold ball; L5 glowing clocks | sky `#A9D3F5` / navy `#1A3A6B` |

## 5. City map

- 13 × 13 grid units. **3 × 3 plots** separated by 1-unit roads with dashed lane markings.
- Plot origin = `(1 + col·4, 1 + row·4)`.

```
          row 0         row 1          row 2
col 0   Поэзия саябағы  Театр          Академия
col 1   Мұнара          ★ РАТУША ★     Грамматика сарайы
col 2   Кітапхана       Көпір          Welcome square (city name sign)
```

- The town hall sits in the centre because it is the final building (the summative tasks).
- The welcome square at the front corner carries the student's **city name** on a sign. It is not a learning building.
- Plots are drawn back to front by `col + row`. Each plot is a focusable `<g class="plot" data-key>` with a transparent hit polygon for clicks and taps.
- **Completion %** = Σ levels / (8 × 5).

## 6. Decorations (spec §6)

The library includes tree (round, pine), bush, flower bed, lamp (unlit/lit), bench, fountain, flag, bunting, string lights, crate, bricks, and sparkle.
In Stage 8, students can also place decorations they unlock onto free tiles (road verges, plot rims). Decorations are cosmetic only and never change scores.

## 7. Adding or changing art

1. A blueprint is `{ key, name, area, icon, colors, footprint, door, spots?, ground?, core(ctx) }`.
2. `core(ctx)` receives `{ L: 2..5, fancy: L ≥ 4, lit: L = 5, c: colors }` and returns SVG. L0, L1, and decorations come from the shared pipeline.
3. Keep every shape inside the 3 × 3 plot and emit shapes back to front.
4. Check the result in the app (`/student`, `/student/building/[key]`) or in `preview.html` → section 05 (all 6 states side by side).
5. To replace the art with artist PNGs later, keep the same keys and levels. Only `renderPlot()` changes.
