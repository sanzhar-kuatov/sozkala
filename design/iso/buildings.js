/*!
 * СӨЗҚАЛА — building blueprints, level pipeline and city layout (Stage 0)
 *
 * Every building lives on a 3×3 plot (local coords 0..3). Visual states:
 *   L0  empty lot  (no graded attempt yet)  — dashed outline + ghost preview
 *   L1  score 1–3  foundation + scaffold + crane
 *   L2  score 4–5  small simple building
 *   L3  score 6–7  full building (+ path to the door)
 *   L4  score 8–9  ornaments, arched windows, flags, trees, flowers
 *   L5  score 10   lights, fountain, greenery, sparkles
 * Levels never go down (see docs/design/02-isometric-art-spec.md).
 */
(function (root) {
  'use strict';
  const I = root.SozqalaIso;
  const { G, iso, box, flat, onLeft, onRight, win, windowRow, door, ftext, pyramid, gable, cylinder, cone, dome,
    disc, ball, tree, bush, flowers, lamp, bench, fountain, flag, bunting, sparkle, crate, bricks, scaffold, crane,
    plot, poly, circle, seg, darken, lighten, svg } = I;

  /** Score (0–10, may be fractional) → visual level 0–5. */
  function levelForScore(score) {
    if (score == null || score < 1) return 0;
    if (score >= 10) return 5;
    if (score >= 8) return 4;
    if (score >= 6) return 3;
    if (score >= 4) return 2;
    return 1;
  }

  const wopts = (ctx, extra = {}) => Object.assign({ arch: ctx.fancy, lit: ctx.lit, frame: ctx.fancy ? ctx.c.trim : '#FFFFFF', mullion: ctx.L >= 3 }, extra);

  /* ====================================================================== */
  /* 1. Грамматика сарайы — palace with a domed tower                      */
  /* ====================================================================== */
  const grammar = {
    key: 'grammar',
    name: { kk: 'Грамматика сарайы', ru: 'Дворец грамматики' },
    area: { kk: 'Емле және грамматика', ru: 'Орфография и грамматика' },
    icon: 'spell-check',
    colors: { wall: '#CDBDFF', roof: '#6D4AE8', trim: '#FFC72C', stone: '#ECE4F7' },
    footprint: [0.5, 0.8, 2.0, 1.4],
    door: [1.5, 2.35],
    core(ctx) {
      const { L, fancy, lit, c } = ctx; const wo = wopts(ctx); let s = '';
      if (L === 2) {
        s += box(0.9, 0.9, G, 1.2, 1.2, 0.9, c.wall);
        s += onLeft(2.1, 0.9, G + 0.9, win(0.12, 0.22, 0.22, 0.3, wo) + win(0.86, 0.22, 0.22, 0.3, wo) + door(0.44, 0.38, 0.32, 0.52, { lit }));
        s += onRight(2.1, 2.1, G + 0.9, windowRow(2, 0, 1.2, 0.22, 0.22, 0.3, wo));
        s += pyramid(0.85, 0.85, G + 0.9, 1.3, 1.3, 0.6, c.roof);
        return s;
      }
      s += box(0.5, 0.8, G, 2.0, 1.4, 1.0, c.wall);
      s += onLeft(2.2, 0.5, G + 1.0, [0.15, 0.5, 1.28, 1.63].map((u) => win(u, 0.22, 0.22, 0.42, wo)).join('') + door(0.78, 0.4, 0.44, 0.6, { arch: fancy, lit }));
      s += onRight(2.5, 2.2, G + 1.0, windowRow(3, 0, 1.4, 0.22, 0.22, 0.42, wo));
      s += box(1.25, 2.2, G, 0.5, 0.15, 0.06, '#ECEFF1');
      s += box(0.45, 0.75, G + 1.0, 2.1, 1.5, 0.08, fancy ? c.trim : '#FFFFFF');
      s += box(1.15, 1.15, G + 1.08, 0.7, 0.7, 0.65, c.wall);
      s += onLeft(1.85, 1.15, G + 1.73, win(0.24, 0.14, 0.22, 0.34, wo));
      s += onRight(1.85, 1.85, G + 1.73, win(0.24, 0.14, 0.22, 0.34, wo));
      s += box(1.1, 1.1, G + 1.73, 0.8, 0.8, 0.06, fancy ? c.trim : '#FFFFFF');
      s += dome(1.5, 1.5, G + 1.79, 0.38, 0.5, c.roof);
      if (fancy) {
        s += cone(1.5, 1.5, G + 2.25, 0.05, 0.4, c.trim);
        for (const [tx, ty] of [[0.5, 2.2], [2.5, 0.8]]) {
          s += cylinder(tx, ty, G, 0.2, 1.3, c.wall) + cylinder(tx, ty, G + 1.3, 0.24, 0.06, c.trim) + cone(tx, ty, G + 1.36, 0.25, 0.5, c.roof);
          s += onLeft(ty + 0.2, tx - 0.07, G + 1.0, win(0, 0.1, 0.14, 0.3, Object.assign({}, wo, { mullion: false })));
          s += flag(tx, ty, G + 1.86, 0.38, c.trim);
        }
      }
      return s;
    },
  };

  /* ====================================================================== */
  /* 2. Сөйлемдер көпірі — bridge over a canal                              */
  /* ====================================================================== */
  const bridge = {
    key: 'bridge',
    name: { kk: 'Сөйлемдер көпірі', ru: 'Мост предложений' },
    area: { kk: 'Синтаксис және тыныс белгілері', ru: 'Синтаксис и пунктуация' },
    icon: 'git-commit-horizontal',
    colors: { stone: '#A9BCD0', roof: '#00AFCA', trim: '#FFC72C', rail: '#F5F7FA', wood: '#C68B59' },
    footprint: [1.0, 0.65, 1.0, 1.7],
    door: null,
    spots: { back: [[0.35, 0.4], [2.6, 0.45]], trees: [[0.3, 2.7], [2.75, 2.15]], fountain: [2.45, 2.6], lamps: [[0.75, 2.75], [2.8, 2.6]], flowers: [[0.55, 2.35], [2.55, 0.65]], bench: [0.15, 2.25] },
    ground(L) {
      const grass = L === 0 ? '#A5D98B' : '#8ED16F';
      let s = plot(0, 0, 3, 1, grass);
      s += box(0, 1, 0, 3, 1, 0.08, '#4FC3F7', { top: '#6ED0F8', left: '#3BA9DD', right: '#2F93C4' });
      for (const [rx, ry] of [[0.4, 1.3], [2.3, 1.6], [1.6, 1.15], [0.7, 1.75]]) {
        const a = iso(rx, ry, 0.08), b = iso(rx + 0.25, ry, 0.08);
        s += seg(a, b, '#E1F5FE', 1.4, { cls: 'iso-ripple' });
      }
      s += plot(0, 2, 3, 1, grass);
      return s;
    },
    core(ctx) {
      const { L, fancy, lit, c } = ctx; let s = '';
      if (L === 2) {
        s += cylinder(1.15, 1.5, 0.05, 0.05, 0.2, c.wood) + cylinder(1.85, 1.5, 0.05, 0.05, 0.2, c.wood);
        s += box(1.1, 0.75, 0.24, 0.8, 1.5, 0.06, c.wood);
        for (const rx of [1.12, 1.88]) {
          for (const ry of [0.8, 1.5, 2.2]) s += seg(iso(rx, ry, 0.3), iso(rx, ry, 0.52), '#8D5A3B', 2);
          s += seg(iso(rx, 0.8, 0.5), iso(rx, 2.2, 0.5), '#8D5A3B', 1.5);
        }
        return s;
      }
      if (fancy) { // boat on the canal (behind the bridge)
        s += box(0.2, 1.38, 0.06, 0.5, 0.24, 0.08, '#FF7043');
        const m = iso(0.45, 1.5, 0.14), t = iso(0.45, 1.5, 0.62);
        s += seg(m, t, '#5D4037', 1.4) + poly([t, [t[0] + 12, m[1] - 4], [t[0], m[1] - 4]], '#FFFFFF');
        if (lit) s += circle(t[0], t[1], 10, 'url(#iso-glow)', { stroke: false, cls: 'iso-pulse' });
      }
      s += box(1.0, 0.7, 0.08, 1.0, 1.6, 0.42, c.stone, { top: '#D7CCC8' });
      s += onRight(2.0, 2.3, 0.5, `<path d="M0.3,0.42L0.3,0.3A0.5,0.24 0 0 1 1.3,0.3L1.3,0.42Z" fill="#2B7FB8"/>` +
        (fancy ? `<path d="M0.22,0.42L0.22,0.29A0.58,0.3 0 0 1 1.38,0.29L1.38,0.42" fill="none" stroke="${c.trim}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>` : ''));
      s += box(1.0, 0.7, 0.5, 0.07, 1.6, 0.16, c.rail);
      if (fancy) s += lamp(1.03, 0.8, 0.66, lit, 0.5) + lamp(1.03, 2.2, 0.66, lit, 0.5);
      s += box(1.93, 0.7, 0.5, 0.07, 1.6, 0.16, c.rail);
      if (fancy) {
        s += lamp(1.96, 0.8, 0.66, lit, 0.5) + lamp(1.96, 2.2, 0.66, lit, 0.5);
        s += bunting(iso(1.96, 0.8, 1.16), iso(1.96, 2.2, 1.16), ['#FF6B6B', '#FFC72C', '#00AFCA', '#7C5CFF'], lit);
      }
      return s;
    },
  };

  /* ====================================================================== */
  /* 3. Білім кітапханасы — classical library with a portico                */
  /* ====================================================================== */
  const library = {
    key: 'library',
    name: { kk: 'Білім кітапханасы', ru: 'Библиотека знаний' },
    area: { kk: 'Оқу және мәтінді талдау', ru: 'Чтение и анализ текста' },
    icon: 'library',
    colors: { wall: '#F2D3A8', column: '#FFF6E5', roof: '#C9603F', trim: '#FFC72C', stone: '#E6DCCB' },
    footprint: [0.5, 0.6, 2.0, 1.8],
    door: [1.5, 2.6],
    core(ctx) {
      const { L, fancy, lit, c } = ctx; const wo = wopts(ctx); let s = '';
      if (L === 2) {
        s += box(0.9, 0.9, G, 1.2, 1.2, 0.75, c.wall);
        s += onLeft(2.1, 0.9, G + 0.75, win(0.12, 0.2, 0.22, 0.28, wo) + win(0.86, 0.2, 0.22, 0.28, wo) + door(0.44, 0.3, 0.32, 0.45, { lit }));
        s += onRight(2.1, 2.1, G + 0.75, windowRow(2, 0, 1.2, 0.2, 0.22, 0.28, wo));
        s += gable(0.85, 0.85, G + 0.75, 1.3, 1.3, 0.45, c.roof, 'y', { wall: c.wall });
        return s;
      }
      s += box(0.5, 0.6, G, 2.0, 1.8, 0.15, c.stone);
      if (fancy) s += box(0.9, 2.4, G, 1.2, 0.2, 0.08, c.stone);
      s += box(0.7, 0.7, G + 0.15, 1.6, 1.3, 0.95, c.wall);
      s += onLeft(2.0, 0.7, G + 1.1, door(0.58, 0.28, 0.44, 0.67, { arch: true, lit }) + win(0.15, 0.25, 0.24, 0.4, wo) + win(1.21, 0.25, 0.24, 0.4, wo));
      s += onRight(2.3, 2.0, G + 1.1, windowRow(3, 0, 1.3, 0.22, 0.24, 0.45, wo));
      for (const cx of [0.74, 1.25, 1.75, 2.26]) s += cylinder(cx, 2.25, G + 0.15, 0.08, 0.95, c.column, { top: '#FFFFFF' });
      s += box(0.6, 0.6, G + 1.1, 1.8, 1.8, 0.14, c.column);
      if (fancy) s += box(0.6, 0.6, G + 1.1, 1.8, 1.8, 0.04, c.trim);
      s += gable(0.6, 0.6, G + 1.24, 1.8, 1.8, 0.5, c.roof, 'y', { wall: c.column });
      s += onLeft(2.4, 0.6, G + 1.74, fancy
        ? `<circle cx="0.9" cy="0.3" r="0.13" fill="${c.trim}"/><path d="M0.82,0.3l0.08,-0.05l0.08,0.05M0.82,0.3v0.06l0.08,-0.04l0.08,0.04v-0.06" stroke="#8D5A3B" stroke-width="1" fill="none" vector-effect="non-scaling-stroke"/>`
        : `<circle cx="0.9" cy="0.3" r="0.1" fill="${darken(c.column, 0.12)}"/>`);
      if (fancy) s += bush(0.72, 2.55, G, 0.8) + bush(2.28, 2.55, G, 0.8);
      return s;
    },
  };

  /* ====================================================================== */
  /* 4. Кейіпкерлер театры — round theatre with a curtain portal           */
  /* ====================================================================== */
  const theatre = {
    key: 'theatre',
    name: { kk: 'Кейіпкерлер театры', ru: 'Театр героев' },
    area: { kk: 'Әдеби кейіпкерлер мен олардың іс-әрекеті', ru: 'Литературные герои и их поступки' },
    icon: 'drama',
    colors: { wall: '#FFB4A8', portal: '#FFE3DC', roof: '#C2185B', curtain: '#D32F2F', trim: '#FFC72C' },
    footprint: [0.55, 0.55, 1.7, 1.9],
    door: [1.4, 2.45],
    core(ctx) {
      const { L, fancy, lit, c } = ctx; let s = '';
      if (L === 2) {
        s += cylinder(1.5, 1.5, G, 0.6, 0.6, c.wall);
        const [ex, ey] = iso(1.5 + 0.6 * Math.SQRT1_2, 1.5 + 0.6 * Math.SQRT1_2, G);
        s += `<path d="M${ex - 7},${ey}L${ex},${ey - 17}L${ex + 7},${ey}Z" fill="${c.curtain}" stroke="${I.OUTLINE}"/>`;
        s += cone(1.5, 1.5, G + 0.6, 0.7, 0.75, c.roof);
        s += flag(1.5, 1.5, G + 1.35, 0.35, c.trim);
        return s;
      }
      if (lit) {
        for (const [bx, by, dx] of [[0.4, 2.7, -40], [2.7, 0.4, 40]]) {
          const b = iso(bx, by, G);
          s += `<polygon points="${b[0] - 2},${b[1]} ${b[0] + 2},${b[1]} ${b[0] + dx + 16},${b[1] - 190} ${b[0] + dx - 16},${b[1] - 190}" fill="url(#iso-beam)" class="iso-beam"/>`;
        }
      }
      s += cylinder(1.4, 1.4, G, 0.85, 1.0, c.wall);
      for (const deg of [-15, 15, 75, 105]) {
        const a = (deg * Math.PI) / 180, k = Math.cos(a - Math.PI / 4);
        const [sx, sy] = iso(1.4 + 0.85 * Math.cos(a), 1.4 + 0.85 * Math.sin(a), G + 0.78);
        s += `<rect x="${sx - 4 * k}" y="${sy - 8}" width="${8 * k}" height="15" rx="${3.5 * k}" fill="${lit ? '#FFE48A' : '#BDE7FF'}" stroke="${fancy ? c.trim : '#FFFFFF'}" stroke-width="1.5"/>`;
      }
      if (fancy) { // posters
        for (const deg of [-40, 130]) {
          const a = (deg * Math.PI) / 180; const [sx, sy] = iso(1.4 + 0.85 * Math.cos(a), 1.4 + 0.85 * Math.sin(a), G + 0.45);
          s += `<rect x="${sx - 4}" y="${sy - 7}" width="8" height="12" fill="${deg < 0 ? '#7C5CFF' : '#00AFCA'}" stroke="#fff" stroke-width="1"/>`;
        }
      }
      s += cylinder(1.4, 1.4, G + 1.0, 0.9, 0.1, fancy ? c.trim : '#FFFFFF');
      s += dome(1.4, 1.4, G + 1.1, 0.86, 0.6, c.roof);
      if (fancy) s += flag(1.4, 1.4, G + 1.7, 0.42, c.trim);
      s += box(1.1, 1.95, G, 0.6, 0.5, 0.85, c.portal);
      let curtain = `<path d="M0.1,0.85V0.4A0.2,0.2 0 0 1 0.5,0.4V0.85Z" fill="${c.curtain}" stroke="${I.OUTLINE}" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
      curtain += `<path d="M0.2,0.3V0.85M0.3,0.22V0.85M0.4,0.3V0.85" stroke="${darken(c.curtain, 0.25)}" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
      curtain += `<path d="M0.1,0.62Q0.22,0.55 0.27,0.42M0.5,0.62Q0.38,0.55 0.33,0.42" stroke="${c.trim}" stroke-width="1.5" fill="none" vector-effect="non-scaling-stroke"/>`;
      if (fancy) for (let i = 0; i <= 8; i++) { const t = Math.PI * (i / 8); curtain += `<circle cx="${(0.3 - 0.25 * Math.cos(t)).toFixed(3)}" cy="${(0.4 - 0.25 * Math.sin(t)).toFixed(3)}" r="0.025" fill="${lit ? '#FFF59D' : '#FFE082'}"/>`; }
      s += onLeft(2.45, 1.1, G + 0.85, curtain);
      s += onRight(1.7, 2.45, G + 0.85, win(0.17, 0.25, 0.16, 0.3, wopts(ctx, { mullion: false })));
      s += gable(1.05, 1.9, G + 0.85, 0.7, 0.6, 0.32, c.roof, 'y', { wall: c.portal });
      if (fancy) s += onLeft(2.5, 1.05, G + 1.17, `<circle cx="0.29" cy="0.19" r="0.065" fill="#FFC72C" stroke="#8D5A3B" stroke-width="1" vector-effect="non-scaling-stroke"/><circle cx="0.42" cy="0.21" r="0.065" fill="#7FC8DC" stroke="#455A64" stroke-width="1" vector-effect="non-scaling-stroke"/>`);
      return s;
    },
  };

  /* ====================================================================== */
  /* 5. Сөздер мұнарасы — tall tower with letter tiles                      */
  /* ====================================================================== */
  const tower = {
    key: 'tower',
    name: { kk: 'Сөздер мұнарасы', ru: 'Башня слов' },
    area: { kk: 'Лексика және фразеология', ru: 'Лексика и фразеология' },
    icon: 'castle',
    colors: { wall: '#FFC37A', roof: '#1E88E5', trim: '#FFFFFF', stone: '#E8DED0', gold: '#FFC72C' },
    footprint: [0.85, 0.85, 1.3, 1.3],
    door: [1.5, 2.15],
    core(ctx) {
      const { L, fancy, lit, c } = ctx; const wo = wopts(ctx, { frame: fancy ? c.gold : '#FFFFFF' }); let s = '';
      if (L === 2) {
        s += box(1.1, 1.1, G, 0.8, 0.8, 1.3, c.wall);
        s += onLeft(1.9, 1.1, G + 1.3, win(0.29, 0.2, 0.22, 0.3, wo) + door(0.24, 0.75, 0.32, 0.55, { lit }));
        s += onRight(1.9, 1.9, G + 1.3, win(0.29, 0.2, 0.22, 0.3, wo) + win(0.29, 0.7, 0.22, 0.3, wo));
        s += pyramid(1.05, 1.05, G + 1.3, 0.9, 0.9, 0.6, c.roof);
        return s;
      }
      s += box(0.85, 0.85, G, 1.3, 1.3, 0.55, c.stone);
      s += onLeft(2.15, 0.85, G + 0.55, door(0.45, 0.1, 0.4, 0.45, { arch: true, lit }));
      s += onRight(2.15, 2.15, G + 0.55, windowRow(2, 0, 1.3, 0.12, 0.2, 0.25, wo));
      s += box(1.05, 1.05, G + 0.55, 0.9, 0.9, 1.7, c.wall);
      if (fancy) {
        let tiles = '';
        'СЛОВО'.split('').forEach((ch, i) => {
          const v = 0.08 + i * 0.32;
          tiles += `<rect x="0.32" y="${v}" width="0.26" height="0.26" rx="0.04" fill="${lit ? '#FFF3C4' : '#FFFFFF'}" stroke="${c.roof}" stroke-width="1.2" vector-effect="non-scaling-stroke"/>` + ftext(0.45, v + 0.135, ch, 0.2, c.roof);
        });
        s += onLeft(1.95, 1.05, G + 2.25, tiles);
      } else {
        s += onLeft(1.95, 1.05, G + 2.25, [0.2, 0.75, 1.3].map((v) => win(0.35, v, 0.2, 0.32, wo)).join(''));
      }
      s += onRight(1.95, 1.95, G + 2.25, [0.2, 0.75, 1.3].map((v) => win(0.35, v, 0.2, 0.32, wo)).join(''));
      s += box(0.95, 0.95, G + 2.25, 1.1, 1.1, 0.1, fancy ? c.gold : c.trim);
      s += box(1.1, 1.1, G + 2.35, 0.8, 0.8, 0.5, c.wall);
      const lantern = win(0.12, 0.1, 0.56, 0.3, Object.assign({}, wo, { mullion: true, arch: false }));
      s += onLeft(1.9, 1.1, G + 2.85, lantern) + onRight(1.9, 1.9, G + 2.85, lantern);
      if (lit) { const [bx, by] = iso(1.5, 1.5, G + 2.6); s += circle(bx, by + 10, 34, 'url(#iso-glow)', { stroke: false, cls: 'iso-pulse' }); }
      s += pyramid(1.05, 1.05, G + 2.85, 0.9, 0.9, 0.75, c.roof);
      if (fancy) { const [ax, ay] = iso(1.5, 1.5, G + 3.62); s += ball(ax, ay, 4, c.gold) + flag(1.5, 1.5, G + 3.68, 0.38, '#FF6B6B'); }
      return s;
    },
  };

  /* ====================================================================== */
  /* 6. Шығармашылық академиясы — modern academy with a glass wing          */
  /* ====================================================================== */
  const academy = {
    key: 'academy',
    name: { kk: 'Шығармашылық академиясы', ru: 'Академия творчества' },
    area: { kk: 'Эссе және шығармашылық жұмыс', ru: 'Эссе и творческие работы' },
    icon: 'palette',
    colors: { wall: '#A8E6C9', glass: '#9FDCF5', roof: '#2E9E6E', trim: '#FFC72C' },
    footprint: [0.5, 0.6, 2.0, 1.8],
    door: [1.1, 2.4],
    spots: { trees: [[0.3, 2.7], [2.78, 0.3]] },
    core(ctx) {
      const { L, fancy, lit, c } = ctx; let s = '';
      const PAL = ['#FF6B6B', '#FFC72C', '#00AFCA', '#7C5CFF'];
      if (L === 2) {
        s += box(0.9, 0.9, G, 1.2, 1.2, 0.8, c.wall);
        s += onLeft(2.1, 0.9, G + 0.8, win(0.1, 0.15, 0.6, 0.3, wopts(ctx, { mullion: true })) + door(0.8, 0.3, 0.28, 0.5, { lit, color: '#2E9E6E' }));
        s += onRight(2.1, 2.1, G + 0.8, win(0.15, 0.15, 0.9, 0.3, wopts(ctx, { mullion: true })));
        s += box(0.85, 0.85, G + 0.8, 1.3, 1.3, 0.08, c.roof);
        return s;
      }
      // block A (tall)
      s += box(0.5, 0.6, G, 1.2, 1.8, 1.4, c.wall);
      let fa = '';
      [[0.1, 0.15], [0.45, 0.15], [0.8, 0.15], [0.1, 0.6], [0.8, 0.6], [0.1, 1.0]].forEach(([u, v], i) => {
        fa += win(u, v, 0.28, 0.3, wopts(ctx, { arch: false, mullion: false, frame: fancy ? PAL[i % 4] : '#FFFFFF' }));
      });
      fa += door(0.45, 0.82, 0.3, 0.58, { lit, color: '#2E9E6E' });
      s += onLeft(2.4, 0.5, G + 1.4, fa);
      let fr = windowRow(4, 0, 1.8, 0.15, 0.28, 0.3, wopts(ctx, { arch: false, mullion: false }));
      fr += win(1.2, 0.6, 0.28, 0.3, wopts(ctx, { arch: false, mullion: false })) + win(1.2, 1.0, 0.28, 0.3, wopts(ctx, { arch: false, mullion: false }));
      s += onRight(1.7, 2.4, G + 1.4, fr);
      if (fancy) s += onLeft(2.4, 0.5, G + 1.4, PAL.map((p, i) => `<rect x="${0.08 + i * 0.27}" y="1.33" width="0.27" height="0.07" fill="${p}"/>`).join(''));
      s += box(0.45, 0.55, G + 1.4, 1.3, 1.9, 0.06, c.roof);
      // block B (glass)
      s += box(1.7, 1.4, G, 0.8, 1.0, 0.9, lit ? '#FFE9A8' : c.glass);
      const grid = (w) => `<path d="${[0.2, 0.4, 0.6, 0.8].filter((u) => u < w).map((u) => `M${u},0V0.9`).join('')}M0,0.3H${w}M0,0.6H${w}" stroke="#ffffff" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`;
      s += onLeft(2.4, 1.7, G + 0.9, grid(0.8)) + onRight(2.5, 2.4, G + 0.9, grid(1.0));
      s += box(1.65, 1.35, G + 0.9, 0.9, 1.1, 0.05, c.roof);
      if (fancy) {
        s += bush(1.95, 1.7, G + 0.95, 0.75) + bush(2.25, 2.1, G + 0.95, 0.75, '#66BB6A');
        // giant pencil sculpture
        s += cylinder(2.75, 0.95, G, 0.1, 0.7, '#FFC72C') + cone(2.75, 0.95, G + 0.7, 0.1, 0.22, '#F5D6A8') + cone(2.75, 0.95, G + 0.85, 0.035, 0.07, '#37474F');
      }
      if (lit) s += bunting(iso(0.45, 2.45, G + 1.46), iso(1.75, 2.45, G + 1.46), [], true);
      return s;
    },
  };

  /* ====================================================================== */
  /* 7. Поэзия саябағы — park with a rotunda                                */
  /* ====================================================================== */
  const park = {
    key: 'park',
    name: { kk: 'Поэзия саябағы', ru: 'Парк поэзии' },
    area: { kk: 'Өлең және көркемдегіш құралдар', ru: 'Стихи и средства выразительности' },
    icon: 'feather',
    colors: { roof: '#F06292', column: '#FFFFFF', stone: '#ECEFF1', trim: '#FFC72C' },
    footprint: [0.85, 0.85, 1.3, 1.3],
    door: null,
    spots: { back: [[0.3, 0.3], [2.7, 0.3], [0.3, 1.0]], trees: [[0.3, 2.7], [2.72, 1.05]], fountain: [2.4, 2.45], lamps: [[1.15, 2.75], [2.75, 1.85]], flowers: [[0.55, 2.2], [2.2, 0.55]], bench: [0.5, 1.75] },
    ground(L) {
      let s = plot(0, 0, 3, 3, L === 0 ? '#A5D98B' : '#86CF67');
      if (L >= 2) s += flat(0, 1.32, 3, 1.68, G + 0.002, '#EADBC0') + flat(1.32, 0, 1.68, 3, G + 0.002, '#EADBC0');
      return s;
    },
    core(ctx) {
      const { L, fancy, lit, c } = ctx; let s = '';
      if (L === 2) {
        s += box(1.1, 1.1, G, 0.8, 0.8, 0.08, c.stone);
        for (const [px, py] of [[1.15, 1.15], [1.85, 1.15], [1.15, 1.85], [1.85, 1.85]]) s += box(px - 0.03, py - 0.03, G + 0.08, 0.06, 0.06, 0.6, c.column);
        s += pyramid(1.05, 1.05, G + 0.68, 0.9, 0.9, 0.4, c.roof);
        s += tree(2.5, 0.5, G, 0.9) + bench(2.2, 2.3);
        return s;
      }
      if (fancy) { // pond with lilies, back-left
        s += disc(0.75, 0.75, G + 0.002, 0.42, '#4FC3F7', { stroke: '#3BA9DD' });
        s += disc(0.65, 0.7, G + 0.01, 0.08, '#66BB6A', { stroke: false }) + disc(0.85, 0.85, G + 0.01, 0.06, '#66BB6A', { stroke: false });
        const [lx, ly] = iso(0.65, 0.7, G + 0.02); s += circle(lx, ly, 1.8, '#F48FB1', { stroke: false });
      }
      s += cylinder(1.5, 1.5, G, 0.65, 0.12, c.stone);
      const cols = [];
      for (let k = 0; k < 6; k++) { const a = (k * 60 + 15) * Math.PI / 180; cols.push([1.5 + 0.52 * Math.cos(a), 1.5 + 0.52 * Math.sin(a)]); }
      cols.sort((p, q) => (p[0] + p[1]) - (q[0] + q[1]));
      cols.forEach(([px, py]) => { s += cylinder(px, py, G + 0.12, 0.05, 0.7, c.column, { top: '#fff' }); });
      s += cylinder(1.5, 1.5, G + 0.82, 0.62, 0.08, fancy ? c.trim : '#FFFFFF');
      s += dome(1.5, 1.5, G + 0.9, 0.62, 0.45, c.roof);
      if (fancy) {
        const [ax, ay] = iso(1.5, 1.5, G + 1.35); s += ball(ax, ay, 3.5, c.trim);
        // poet statue on a pedestal
        s += box(2.3, 2.25, G, 0.24, 0.24, 0.32, '#B0BEC5');
        const [hx, hy] = iso(2.42, 2.37, G + 0.32); s += ball(hx, hy - 6, 5, '#90A4AE') + `<path d="M${hx - 6},${hy}Q${hx},${hy - 6} ${hx + 6},${hy}Z" fill="#90A4AE"/>`;
        // rose arch over the front path
        const a = iso(1.32, 2.85, G), b = iso(1.68, 2.85, G);
        s += `<path d="M${a[0]},${a[1]}V${a[1] - 22}Q${(a[0] + b[0]) / 2},${a[1] - 40} ${b[0]},${b[1] - 22}V${b[1]}" fill="none" stroke="#66BB6A" stroke-width="3"/>`;
        for (let i = 0; i < 6; i++) s += circle(a[0] + (b[0] - a[0]) * (i / 5), a[1] - 26 - Math.sin((i / 5) * Math.PI) * 8 + (b[1] - a[1]) * (i / 5), 2.2, '#F06292', { stroke: false });
      } else {
        s += bench(2.2, 2.3) + tree(2.5, 0.5, G, 0.9);
      }
      if (lit) {
        const pts = [[40, -30], [-50, -5], [-20, -70], [60, 10], [10, -95]];
        pts.forEach(([dx, dy], i) => { s += circle(dx, 48 + dy, 2, '#FFF59D', { stroke: false, cls: 'iso-pulse', style: `animation-delay:${i * 0.4}s` }); });
      }
      return s;
    },
  };

  /* ====================================================================== */
  /* 8. Білім ратушасы — town hall with a clock tower                       */
  /* ====================================================================== */
  const townhall = {
    key: 'townhall',
    name: { kk: 'Білім ратушасы', ru: 'Ратуша знаний' },
    area: { kk: 'Қорытынды тапсырмалар', ru: 'Итоговые задания' },
    icon: 'landmark',
    colors: { wall: '#A9D3F5', wall2: '#DCEEFC', roof: '#1A3A6B', trim: '#FFC72C' },
    footprint: [0.45, 0.7, 2.1, 1.9],
    door: [1.5, 2.6],
    core(ctx) {
      const { L, fancy, lit, c } = ctx; const wo = wopts(ctx); let s = '';
      const clock = (cx, cy, r) => {
        let k = '';
        if (lit) k += `<circle cx="${cx}" cy="${cy}" r="${r * 1.6}" fill="#FFE082" opacity=".45" class="iso-pulse"/>`;
        k += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${lit ? '#FFF8E1' : '#FFFFFF'}" stroke="${fancy ? c.trim : c.roof}" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
        k += `<path d="M${cx},${cy}V${cy - r * 0.7}M${cx},${cy}H${cx + r * 0.5}" stroke="${c.roof}" stroke-width="1.5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
        return k;
      };
      if (L === 2) {
        s += box(0.8, 0.9, G, 1.4, 1.2, 0.85, c.wall);
        s += onLeft(2.1, 0.8, G + 0.85, win(0.15, 0.22, 0.24, 0.3, wo) + win(1.01, 0.22, 0.24, 0.3, wo) + door(0.53, 0.35, 0.34, 0.5, { lit }));
        s += onRight(2.2, 2.1, G + 0.85, windowRow(2, 0, 1.2, 0.22, 0.24, 0.3, wo));
        s += gable(0.75, 0.85, G + 0.85, 1.5, 1.3, 0.5, c.roof, 'x', { wall: c.wall });
        s += onRight(2.25, 1.9, G + 1.2, clock(0.4, 0.22, 0.13));
        return s;
      }
      s += box(0.45, 0.7, G, 2.1, 1.3, 1.1, c.wall);
      s += onLeft(2.0, 0.45, G + 1.1, [0.12, 0.45, 1.45, 1.78].map((u) => win(u, 0.2, 0.2, 0.36, wo) + win(u, 0.66, 0.2, 0.3, wo)).join(''));
      s += onRight(2.55, 2.0, G + 1.1, windowRow(3, 0, 1.3, 0.2, 0.2, 0.36, wo) + windowRow(3, 0, 1.3, 0.66, 0.2, 0.3, wo));
      if (fancy) { // ornament band (stylised "қошқар мүйіз" curls)
        const band = (len) => {
          let o = '';
          for (let u = 0.05; u + 0.2 <= len; u += 0.2) o += `<path d="M${u.toFixed(2)},0.1q0.05,-0.07 0.1,0q0.05,0.07 0.1,0" fill="none" stroke="${c.trim}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>`;
          return o;
        };
        s += onLeft(2.0, 0.45, G + 1.1, band(2.1)) + onRight(2.55, 2.0, G + 1.1, band(1.3));
      }
      s += gable(0.4, 0.65, G + 1.1, 2.2, 1.4, 0.55, c.roof, 'x', { wall: c.wall });
      if (fancy) s += flag(0.55, 1.35, G + 1.55, 0.4, c.trim) + flag(2.45, 1.35, G + 1.55, 0.4, '#00AFCA');
      // clock tower
      s += box(1.2, 2.0, G, 0.6, 0.6, 2.2, c.wall2);
      s += onLeft(2.6, 1.2, G + 2.2, clock(0.3, 0.32, 0.19) + win(0.19, 0.75, 0.22, 0.42, wopts(ctx, { arch: true })) + door(0.14, 1.55, 0.32, 0.65, { arch: true, lit }));
      s += onRight(1.8, 2.6, G + 2.2, clock(0.3, 0.32, 0.19) + win(0.19, 0.75, 0.22, 0.42, wopts(ctx, { arch: true })));
      s += box(1.15, 1.95, G + 2.2, 0.7, 0.7, 0.06, fancy ? c.trim : '#FFFFFF');
      s += pyramid(1.15, 1.95, G + 2.26, 0.7, 0.7, 0.75, c.roof);
      if (fancy) { const [ax, ay] = iso(1.5, 2.3, G + 3.02); s += ball(ax, ay, 4, c.trim) + flag(1.5, 2.3, G + 3.08, 0.4, '#FF6B6B'); }
      return s;
    },
  };

  const BUILDINGS = [grammar, bridge, library, theatre, tower, academy, park, townhall];
  const byKey = Object.fromEntries(BUILDINGS.map((b) => [b.key, b]));

  /* ====================================================================== */
  /* Level pipeline (shared by all buildings)                               */
  /* ====================================================================== */
  const DEFAULT_SPOTS = {
    back: [[0.35, 0.4], [2.6, 0.35], [0.3, 1.3]],
    trees: [[0.3, 2.7], [2.72, 1.2]],
    fountain: [2.55, 2.6],
    lamps: [[0.9, 2.75], [2.75, 1.7]],
    flowers: [[0.55, 2.55], [2.7, 0.55], [1.95, 2.8]],
    bench: [2.55, 1.95],
  };

  function emptyLot(b) {
    const [x, y, w, d] = b.footprint;
    let s = `<g class="iso-ghost">${b.core({ L: 3, fancy: false, lit: false, c: b.colors })}</g>`;
    s += poly([iso(x, y, G), iso(x + w, y, G), iso(x + w, y + d, G), iso(x, y + d, G)], 'rgba(255,255,255,.22)', { stroke: '#ffffff', sw: 1.6, style: 'stroke-dasharray:5 4' });
    for (const [sx, sy] of [[x, y], [x + w, y], [x, y + d], [x + w, y + d]]) {
      const a = iso(sx, sy, G), t = iso(sx, sy, G + 0.3);
      s += seg(a, t, '#8D5A3B', 1.5) + poly([t, [t[0] + 7, t[1] + 2.5], [t[0], t[1] + 5]], '#FF7043', { stroke: false });
    }
    // sign "+": post and board
    s += seg(iso(2.55, 2.6, G), iso(2.55, 2.6, G + 0.5), '#8D5A3B', 2.5);
    s += box(2.3, 2.6, G + 0.42, 0.5, 0.05, 0.32, '#FFFFFF', { left: '#FFFFFF' });
    s += onLeft(2.65, 2.3, G + 0.74, ftext(0.25, 0.16, '+', 0.32, '#00AFCA', { weight: 800 }));
    return s;
  }

  function construction(b) {
    const [x, y, w, d] = b.footprint;
    let s = box(x, y, G, w, d, 0.1, '#D9CFC1');
    s += crane(x + 0.05, y + 0.05, G + 0.1, Math.max(1.6, d + 0.4));
    s += scaffold(x + 0.08, y + 0.08, G + 0.1, w - 0.16, d - 0.16, 1.1);
    s += bricks(0.2, 2.55) + crate(2.55, 2.5) + crate(2.6, 2.15, G, 0.2);
    return s;
  }

  function decor(b, ctx) {
    const sp = Object.assign({}, DEFAULT_SPOTS, b.spots || {});
    const back = [], front = [];
    const add = (list, x, y, svgStr) => list.push({ d: x + y, s: svgStr });
    if (ctx.L >= 4) sp.back.slice(0, ctx.L === 5 ? 3 : 2).forEach(([x, y], i) => add(back, x, y, tree(x, y, G, 0.9, i % 2 ? 'pine' : 'round')));
    if (ctx.L >= 3) add(front, sp.trees[0][0], sp.trees[0][1], tree(sp.trees[0][0], sp.trees[0][1], G, 0.8));
    if (ctx.L >= 4) {
      add(front, sp.trees[1][0], sp.trees[1][1], tree(sp.trees[1][0], sp.trees[1][1], G, 0.85, 'pine'));
      sp.flowers.slice(0, ctx.L === 5 ? 3 : 2).forEach(([x, y]) => add(front, x, y, flowers(x, y)));
      sp.lamps.forEach(([x, y]) => add(front, x, y, lamp(x, y, G, ctx.lit)));
      add(front, sp.bench[0], sp.bench[1], bench(sp.bench[0], sp.bench[1]));
    }
    if (ctx.L === 5) add(front, sp.fountain[0], sp.fountain[1], fountain(sp.fountain[0], sp.fountain[1]));
    const sort = (l) => l.sort((p, q) => p.d - q.d).map((i) => i.s).join('');
    return { back: sort(back), front: sort(front) };
  }

  const SPARKLES = [[-58, -40, 6], [56, -70, 7], [-22, -112, 5], [72, 4, 5], [-82, 18, 6], [18, -138, 6], [36, -20, 4]];

  /**
   * Render one building plot.
   * @param {object|string} b  blueprint or key
   * @param {number} level 0–5
   * @param {{animate?: boolean}} opts animate=true plays the build/upgrade animation
   */
  function renderPlot(b, level, opts = {}) {
    if (typeof b === 'string') b = byKey[b];
    const L = Math.max(0, Math.min(5, level | 0));
    let s = b.ground ? b.ground(L) : plot(0, 0, 3, 3, L === 0 ? '#A5D98B' : '#8ED16F');
    if (L >= 3 && b.door) s += flat(b.door[0] - 0.17, b.door[1], b.door[0] + 0.17, 3, G + 0.002, '#EADBC0');
    let body;
    if (L === 0) body = emptyLot(b);
    else if (L === 1) body = construction(b);
    else {
      const ctx = { L, fancy: L >= 4, lit: L === 5, c: b.colors };
      const dc = decor(b, ctx);
      body = dc.back + b.core(ctx) + dc.front;
      if (L === 5) body += SPARKLES.map(([x, y, r], i) => sparkle(x, y, r, i * 0.37)).join('');
    }
    s += `<g class="iso-build${opts.animate && L > 0 ? ' is-rising' : ''}">${body}</g>`;
    if (opts.animate && L > 0) {
      s += `<g class="iso-dust">${[[-60, 70], [-30, 88], [10, 92], [50, 78], [70, 58]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${7 + (i % 3) * 2}" fill="#F3EDE3" style="animation-delay:${i * 0.06}s"/>`).join('')}</g>`;
    }
    return s;
  }
  const PLOT_VIEWBOX = '-104 -150 208 262';
  const buildingSvg = (b, level, opts = {}) => {
    const bp = typeof b === 'string' ? byKey[b] : b;
    return svg(PLOT_VIEWBOX, renderPlot(bp, level, opts), { label: `${bp.name.ru} — ${level}`, cls: opts.cls || 'iso-svg' });
  };

  /* ====================================================================== */
  /* City map: 3×3 grid of 3×3 plots separated by 1-unit roads             */
  /* ====================================================================== */
  const CITY_LAYOUT = [
    // [col, row, key]
    [0, 0, 'park'], [1, 0, 'tower'], [2, 0, 'library'],
    [0, 1, 'theatre'], [1, 1, 'townhall'], [2, 1, 'bridge'],
    [0, 2, 'academy'], [1, 2, 'grammar'], [2, 2, '__square'],
  ];
  const CITY_VIEWBOX = '-440 -150 880 600';

  function welcomeSquare(cityName) {
    let s = box(0, 0, 0, 3, 3, G, '#E7DCCB', { top: '#EFE6D8', left: '#B98A5E', right: '#9C7049' });
    for (let i = 0.5; i < 3; i += 0.5) s += seg(iso(i, 0, G), iso(i, 3, G), '#DCCFBC', 1) + seg(iso(0, i, G), iso(3, i, G), '#DCCFBC', 1);
    s += tree(0.45, 0.45, G, 0.9) + tree(2.55, 0.45, G, 0.85, 'pine');
    s += box(0.75, 1.55, G, 0.1, 0.1, 0.8, '#5D4037') + box(2.15, 1.55, G, 0.1, 0.1, 0.8, '#5D4037');
    s += box(0.6, 1.58, G + 0.55, 1.8, 0.06, 0.5, '#00AFCA', { left: '#00AFCA' });
    s += onLeft(1.64, 0.6, G + 1.05, ftext(0.9, 0.2, cityName, 0.24, '#FFFFFF', { weight: 800 }) + `<path d="M0.15,0.4H1.65" stroke="#FFC72C" stroke-width="2" vector-effect="non-scaling-stroke"/>`);
    s += flowers(0.5, 2.5) + flowers(2.5, 2.5) + bench(1.3, 2.55) + lamp(0.4, 1.9) + lamp(2.6, 1.9);
    return s;
  }

  /** levels: { [key]: 0..5 }  opts: { cityName, animateKey } */
  function renderCity(levels, opts = {}) {
    const N = 13;
    let s = box(0, 0, -0.5, N, N, 0.5, '#8ED16F', { left: '#B98A5E', right: '#9C7049', top: '#93D474' });
    for (let k = 0; k < 4; k++) {
      const b = k * 4;
      s += flat(0, b, N, b + 1, 0.001, '#CDD3DB') + flat(b, 0, b + 1, N, 0.001, '#CDD3DB');
    }
    for (let k = 0; k < 4; k++) {
      const m = k * 4 + 0.5;
      s += seg(iso(0, m, 0.002), iso(N, m, 0.002), '#FFFFFF', 1.2, { dash: '6 6' }) + seg(iso(m, 0, 0.002), iso(m, N, 0.002), '#FFFFFF', 1.2, { dash: '6 6' });
    }
    const cells = CITY_LAYOUT.slice().sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[0] - b[0]);
    for (const [col, row, key] of cells) {
      const [tx, ty] = iso(1 + col * 4, 1 + row * 4, 0);
      const inner = key === '__square' ? welcomeSquare(opts.cityName || 'СӨЗҚАЛА') : renderPlot(byKey[key], levels[key] || 0, { animate: opts.animateKey === key });
      const hit = `<polygon class="plot-hit" points="${[iso(0, 0, G), iso(3, 0, G), iso(3, 3, G), iso(0, 3, G)].map((p) => p.join(',')).join(' ')}" fill="transparent"/>`;
      s += `<g transform="translate(${tx},${ty})"><g class="plot${key === '__square' ? ' plot--square' : ''}" data-key="${key}" tabindex="${key === '__square' ? -1 : 0}">${hit}${inner}</g></g>`;
    }
    return s;
  }
  const citySvg = (levels, opts = {}) => svg(CITY_VIEWBOX, renderCity(levels, opts), { label: opts.cityName || 'СӨЗҚАЛА', cls: 'iso-city' });

  /** City completion % (sum of levels / max). */
  const completion = (levels) => Math.round((BUILDINGS.reduce((n, b) => n + (levels[b.key] || 0), 0) / (BUILDINGS.length * 5)) * 100);

  root.SozqalaCity = { BUILDINGS, byKey, levelForScore, renderPlot, buildingSvg, renderCity, citySvg, completion, PLOT_VIEWBOX, CITY_VIEWBOX };
})(typeof window !== 'undefined' ? window : globalThis);
