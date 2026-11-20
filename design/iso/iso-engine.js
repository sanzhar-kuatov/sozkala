/*!
 * СӨЗҚАЛА — isometric SVG engine (Stage 0 prototype)
 *
 * Pure functions that return SVG markup strings. No DOM access, so this file
 * ports 1:1 to TypeScript in Stage 4 (components/city/iso.ts).
 *
 * World axes:  x → screen down-right,  y → screen down-left,  z → up.
 * 1 grid unit = a 64×32 px diamond (2:1 dimetric), 1 height unit = 34 px.
 * Light comes from the top-left: top faces lightest, +y ("left") faces base
 * colour, +x ("right") faces darkest.
 *
 * Drawing is painter's-algorithm: callers emit shapes back-to-front
 * (ascending x + y, then ascending z).
 */
(function (root) {
  'use strict';

  const TW = 64, TH = 32, ZU = 34;
  const HW = TW / 2, HH = TH / 2;
  const G = 0.2; // top of a plot's ground slab
  const OUTLINE = 'rgba(30,42,59,0.30)';
  const NS = 'vector-effect="non-scaling-stroke"';

  const rnd = (n) => Math.round(n * 100) / 100;
  const iso = (x, y, z = 0) => [rnd((x - y) * HW), rnd((x + y) * HH - z * ZU)];
  const P = (arr) => arr.map((p) => p.join(',')).join(' ');

  /* ---------------------------------------------------------------- colour */
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgbToHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A.map((v, i) => v + (B[i] - v) * t)); };
  const lighten = (c, t) => mix(c, '#ffffff', t);
  const darken = (c, t) => mix(c, '#1e2a3b', t);
  const shades = (c) => ({ top: lighten(c, 0.22), left: c, right: darken(c, 0.2) });

  /* ------------------------------------------------------------ primitives */
  function attrs(o) {
    let s = '';
    if (o.stroke !== false) s += ` stroke="${o.stroke || OUTLINE}" stroke-width="${o.sw || 1}" stroke-linejoin="round"`;
    if (o.opacity != null) s += ` opacity="${o.opacity}"`;
    if (o.cls) s += ` class="${o.cls}"`;
    if (o.style) s += ` style="${o.style}"`;
    return s;
  }
  const poly = (pts, fill, o = {}) => `<polygon points="${P(pts)}" fill="${fill}"${attrs(o)}/>`;
  const circle = (cx, cy, r, fill, o = {}) => `<circle cx="${rnd(cx)}" cy="${rnd(cy)}" r="${rnd(r)}" fill="${fill}"${attrs(o)}/>`;
  const seg = (a, b, color, w = 2, o = {}) =>
    `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}${o.cls ? ` class="${o.cls}"` : ''}${o.opacity != null ? ` opacity="${o.opacity}"` : ''}/>`;

  /** Axis-aligned box. Emits the two visible side faces and the top. */
  function box(x, y, z, w, d, h, color, o = {}) {
    const s = shades(color);
    const left = [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
    const right = [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)];
    const top = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
    return poly(left, o.left || s.left, o) + poly(right, o.right || s.right, o) + poly(top, o.top || s.top, o);
  }

  /** Flat rectangle lying on the plane z (paths, water, plazas). */
  const flat = (x1, y1, x2, y2, z, fill, o = {}) =>
    poly([iso(x1, y1, z), iso(x2, y1, z), iso(x2, y2, z), iso(x1, y2, z)], fill, Object.assign({ stroke: false }, o));

  /* ------------------------------------------------- drawing ON a wall face
     Content is authored in local face units: u → along the wall, v ↓ from the
     wall top. Strokes inside must use vector-effect="non-scaling-stroke".   */

  /** Wall facing +y (screen lower-left). u runs +x from x0. */
  function onLeft(yF, x0, zTop, inner) {
    const [sx, sy] = iso(x0, yF, zTop);
    return `<g transform="matrix(${HW},${HH},0,${ZU},${sx},${sy})">${inner}</g>`;
  }
  /** Wall facing +x (screen lower-right). u runs −y from y0 (the near edge). */
  function onRight(xF, y0, zTop, inner) {
    const [sx, sy] = iso(xF, y0, zTop);
    return `<g transform="matrix(${HW},${-HH},0,${ZU},${sx},${sy})">${inner}</g>`;
  }

  /** Window in face units. o: { arch, lit, frame, glass, mullion } */
  function win(u, v, w, h, o = {}) {
    const glass = o.lit ? '#FFE48A' : (o.glass || '#BDE7FF');
    const frame = o.frame || '#FFFFFF';
    const shape = (p, fill, extra = '') => o.arch
      ? `<path d="M${rnd(u - p)},${rnd(v + h + p)}V${rnd(v + w / 2)}A${rnd(w / 2 + p)},${rnd(w / 2 + p)} 0 0 1 ${rnd(u + w + p)},${rnd(v + w / 2)}V${rnd(v + h + p)}Z" fill="${fill}" ${extra}/>`
      : `<rect x="${rnd(u - p)}" y="${rnd(v - p)}" width="${rnd(w + 2 * p)}" height="${rnd(h + 2 * p)}" fill="${fill}" ${extra}/>`;
    let s = '';
    if (o.lit) s += shape(0.09, '#FFD54F', 'opacity="0.4" class="iso-pulse"');
    s += shape(0.045, frame, `stroke="${OUTLINE}" stroke-width="1" ${NS}`);
    s += shape(0, glass);
    if (!o.lit) s += `<path d="M${rnd(u + w * 0.2)},${rnd(v + h * 0.75)}L${rnd(u + w * 0.7)},${rnd(v + h * 0.3)}" stroke="#fff" stroke-opacity=".75" stroke-width="1.3" ${NS}/>`;
    if (o.mullion) {
      s += `<path d="M${rnd(u + w / 2)},${rnd(v)}V${rnd(v + h)}M${rnd(u)},${rnd(v + h * 0.58)}H${rnd(u + w)}" stroke="${frame}" stroke-width="1.4" ${NS}/>`;
    }
    return s;
  }
  function windowRow(n, u0, u1, v, w, h, o) {
    const gap = (u1 - u0 - n * w) / (n + 1);
    let s = '';
    for (let i = 0; i < n; i++) s += win(u0 + gap + i * (w + gap), v, w, h, o);
    return s;
  }
  /** Door in face units. o: { arch, color, lit } */
  function door(u, v, w, h, o = {}) {
    const c = o.color || '#7A4B2A';
    const d = o.arch
      ? `M${rnd(u)},${rnd(v + h)}V${rnd(v + w / 2)}A${rnd(w / 2)},${rnd(w / 2)} 0 0 1 ${rnd(u + w)},${rnd(v + w / 2)}V${rnd(v + h)}Z`
      : `M${rnd(u)},${rnd(v + h)}V${rnd(v)}H${rnd(u + w)}V${rnd(v + h)}Z`;
    let s = '';
    if (o.lit) s += `<path d="${d}" fill="#FFD54F" opacity=".45" transform="translate(${rnd(u + w / 2)},${rnd(v + h)}) scale(1.35) translate(${rnd(-(u + w / 2))},${rnd(-(v + h))})" class="iso-pulse"/>`;
    s += `<path d="${d}" fill="${c}" stroke="${OUTLINE}" stroke-width="1" ${NS}/>`;
    s += `<path d="M${rnd(u + w / 2)},${rnd(v + (o.arch ? w * 0.25 : 0.04))}V${rnd(v + h)}" stroke="${darken(c, 0.25)}" stroke-width="1" ${NS}/>`;
    s += `<circle cx="${rnd(u + w * 0.38)}" cy="${rnd(v + h * 0.6)}" r="0.022" fill="#FFC72C"/>`;
    return s;
  }
  /** Text painted on a face (signs, letter tiles). */
  const ftext = (u, v, str, size, fill, o = {}) =>
    `<text x="${u}" y="${v}" font-size="${size}" font-family="Rubik, Nunito, sans-serif" font-weight="${o.weight || 700}" text-anchor="middle" dominant-baseline="central" fill="${fill}">${str}</text>`;

  /* ----------------------------------------------------------------- roofs */
  function pyramid(x, y, z, w, d, h, color, o = {}) {
    const s = shades(color);
    const a = iso(x + w / 2, y + d / 2, z + h);
    const A = iso(x, y, z), B = iso(x + w, y, z), C = iso(x + w, y + d, z), D = iso(x, y + d, z);
    return poly([A, B, a], darken(color, 0.05), o) + poly([D, A, a], lighten(color, 0.12), o) +
      poly([D, C, a], s.left, o) + poly([B, C, a], s.right, o);
  }
  /** Gable roof. axis 'x' → ridge along x, triangular end on the right face;
      axis 'y' → ridge along y, triangular end (pediment) on the left face. */
  function gable(x, y, z, w, d, h, color, axis = 'x', o = {}) {
    const s = shades(color);
    const wall = o.wall || color;
    if (axis === 'x') {
      const ym = y + d / 2;
      return poly([iso(x, y, z), iso(x + w, y, z), iso(x + w, ym, z + h), iso(x, ym, z + h)], s.top, o) +
        poly([iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, ym, z + h), iso(x, ym, z + h)], s.left, o) +
        poly([iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, ym, z + h)], shades(wall).right, o);
    }
    const xm = x + w / 2;
    return poly([iso(x, y, z), iso(x, y + d, z), iso(xm, y + d, z + h), iso(xm, y, z + h)], s.top, o) +
      poly([iso(x + w, y, z), iso(x + w, y + d, z), iso(xm, y + d, z + h), iso(xm, y, z + h)], s.right, o) +
      poly([iso(x, y + d, z), iso(x + w, y + d, z), iso(xm, y + d, z + h)], wall, o);
  }

  /* ------------------------------------------------------ round primitives */
  const ell = (x, y, z, r) => { const [cx, cy] = iso(x, y, z); return { cx, cy, rx: rnd(r * Math.SQRT2 * HW), ry: rnd(r * Math.SQRT2 * HH) }; };

  function cylinder(x, y, z, r, h, color, o = {}) {
    const b = ell(x, y, z, r), t = ell(x, y, z + h, r);
    const side = `M${rnd(b.cx - b.rx)},${t.cy}L${rnd(b.cx - b.rx)},${b.cy}A${b.rx},${b.ry} 0 0 0 ${rnd(b.cx + b.rx)},${b.cy}L${rnd(b.cx + b.rx)},${t.cy}Z`;
    return `<path d="${side}" fill="${color}"${attrs(o)}/><path d="${side}" fill="url(#iso-cyl)"/>` +
      `<ellipse cx="${t.cx}" cy="${t.cy}" rx="${t.rx}" ry="${t.ry}" fill="${o.top || lighten(color, 0.22)}"${attrs(o)}/>`;
  }
  function cone(x, y, z, r, h, color, o = {}) {
    const b = ell(x, y, z, r); const [ax, ay] = iso(x, y, z + h);
    const d = `M${rnd(b.cx - b.rx)},${b.cy}L${ax},${ay}L${rnd(b.cx + b.rx)},${b.cy}A${b.rx},${b.ry} 0 0 1 ${rnd(b.cx - b.rx)},${b.cy}Z`;
    return `<path d="${d}" fill="${color}"${attrs(o)}/><path d="${d}" fill="url(#iso-cyl)"/>`;
  }
  function dome(x, y, z, r, h, color, o = {}) {
    const b = ell(x, y, z, r); const hp = rnd(h * ZU);
    const d = `M${rnd(b.cx - b.rx)},${b.cy}A${b.rx},${hp} 0 0 1 ${rnd(b.cx + b.rx)},${b.cy}A${b.rx},${b.ry} 0 0 1 ${rnd(b.cx - b.rx)},${b.cy}Z`;
    return `<path d="${d}" fill="${color}"${attrs(o)}/><path d="${d}" fill="url(#iso-sph)"/>`;
  }
  const disc = (x, y, z, r, fill, o = {}) => { const e = ell(x, y, z, r); return `<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}" fill="${fill}"${attrs(o)}/>`; };
  /** Screen-space ball (foliage, ornaments). r in px. */
  const ball = (cx, cy, r, color, o = {}) => circle(cx, cy, r, color, o) + circle(cx, cy, r, 'url(#iso-sph)', { stroke: false });

  /* ------------------------------------------------------------ decoration */
  function tree(x, y, z = G, s = 1, kind = 'round', color = '#5DBB63') {
    let out = cylinder(x, y, z, 0.05 * s, 0.32 * s, '#8D5A3B', { stroke: false });
    if (kind === 'pine') {
      return out + cone(x, y, z + 0.18 * s, 0.3 * s, 0.6 * s, darken(color, 0.12)) + cone(x, y, z + 0.5 * s, 0.22 * s, 0.5 * s, color);
    }
    const [cx, cy] = iso(x, y, z + 0.6 * s); const R = 12 * s;
    return out + ball(cx - R * 0.45, cy + R * 0.3, R * 0.72, darken(color, 0.1)) + ball(cx, cy, R, color) + ball(cx + R * 0.45, cy - R * 0.25, R * 0.55, lighten(color, 0.15), { stroke: false });
  }
  function bush(x, y, z = G, s = 1, color = '#4CAF50') {
    const [cx, cy] = iso(x, y, z + 0.1 * s);
    return ball(cx - 4 * s, cy, 6 * s, darken(color, 0.06)) + ball(cx + 4 * s, cy - 1, 6.5 * s, color);
  }
  function flowers(x, y, z = G, colors = ['#FF6B9A', '#FFC72C', '#FFFFFF', '#B388FF']) {
    const [cx, cy] = iso(x, y, z);
    const spots = [[-7, 0], [-2, -3], [4, -1], [8, 2], [1, 3], [-5, 4]];
    return ball(cx, cy + 1, 9, '#6FB552', { stroke: false }) +
      spots.map(([dx, dy], i) => circle(cx + dx, cy + dy - 2, 2.4, colors[i % colors.length], { stroke: false })).join('');
  }
  function lamp(x, y, z = G, lit = false, h = 0.75) {
    const a = iso(x, y, z), t = iso(x, y, z + h);
    let s = seg(a, t, '#37474F', 2);
    if (lit) s += circle(t[0], t[1], 16, 'url(#iso-glow)', { stroke: false, cls: 'iso-pulse' });
    s += circle(t[0], t[1] - 1, 3.6, lit ? '#FFF3B0' : '#ECEFF1', { stroke: '#37474F', sw: 1 });
    return s;
  }
  function bench(x, y, z = G, color = '#C68B59') {
    return box(x, y, z + 0.1, 0.4, 0.12, 0.04, color) + box(x, y, z + 0.14, 0.4, 0.03, 0.16, darken(color, 0.1)) +
      seg(iso(x + 0.03, y + 0.1, z), iso(x + 0.03, y + 0.1, z + 0.1), '#455A64', 1.5) +
      seg(iso(x + 0.37, y + 0.1, z), iso(x + 0.37, y + 0.1, z + 0.1), '#455A64', 1.5);
  }
  function fountain(x, y, z = G, r = 0.3) {
    let s = cylinder(x, y, z, r, 0.12, '#D5DEE6');
    s += disc(x, y, z + 0.12, r * 0.84, '#5BC8F5', { stroke: false });
    s += cylinder(x, y, z + 0.12, r * 0.13, 0.3, '#E3EAF0');
    s += cylinder(x, y, z + 0.42, r * 0.42, 0.05, '#D5DEE6');
    const top = iso(x, y, z + 0.7);
    s += seg(iso(x, y, z + 0.47), top, '#E1F5FE', 2, { cls: 'iso-spray' });
    for (const a of [0.3, 1.9, 3.5, 5.1]) {
      const e = iso(x + r * 0.62 * Math.cos(a), y + r * 0.62 * Math.sin(a), z + 0.13);
      const c = [rnd((top[0] + e[0]) / 2 + (e[0] - top[0]) * 0.35), rnd(top[1] - 8)];
      s += `<path d="M${top[0]},${top[1]}Q${c[0]},${c[1]} ${e[0]},${e[1]}" fill="none" stroke="#E1F5FE" stroke-width="1.6" class="iso-spray"/>`;
    }
    return s;
  }
  function flag(x, y, z, h = 0.4, color = '#FFC72C') {
    const a = iso(x, y, z), t = iso(x, y, z + h);
    return seg(a, t, '#455A64', 1.4) + poly([t, [t[0] + 14, t[1] + 4], [t[0], t[1] + 9]], color, { cls: 'iso-flag', sw: 0.8 });
  }
  /** Bunting / string lights between two screen points. */
  function bunting(a, b, colors, lights = false) {
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 9];
    let s = `<path d="M${a[0]},${a[1]}Q${mid[0]},${mid[1]} ${b[0]},${b[1]}" fill="none" stroke="#546E7A" stroke-width="1"/>`;
    const n = 7;
    for (let i = 1; i < n; i++) {
      const t = i / n, it = 1 - t;
      const px = it * it * a[0] + 2 * it * t * mid[0] + t * t * b[0];
      const py = it * it * a[1] + 2 * it * t * mid[1] + t * t * b[1];
      s += lights
        ? circle(px, py + 1.5, 2.2, '#FFE082', { stroke: false, cls: 'iso-pulse', style: `animation-delay:${i * 0.25}s` }) + circle(px, py + 1.5, 6, 'url(#iso-glow)', { stroke: false })
        : poly([[px - 3, py], [px + 3, py], [px, py + 6]], colors[i % colors.length], { stroke: false });
    }
    return s;
  }
  function sparkle(cx, cy, s = 6, delay = 0, color = '#FFF6C2') {
    return `<path d="M${cx},${cy - s}Q${cx},${cy} ${cx + s},${cy}Q${cx},${cy} ${cx},${cy + s}Q${cx},${cy} ${cx - s},${cy}Q${cx},${cy} ${cx},${cy - s}Z" fill="${color}" stroke="#FFC72C" stroke-width=".6" class="iso-twinkle" style="animation-delay:${delay}s"/>`;
  }
  const crate = (x, y, z = G, s = 0.25) => box(x, y, z, s, s, s, '#C68B59') +
    seg(iso(x, y + s, z), iso(x + s, y + s, z + s), '#8D5A3B', 1) + seg(iso(x + s, y, z), iso(x + s, y + s, z + s), '#8D5A3B', 1);
  function bricks(x, y, z = G) {
    let s = '';
    [[0, 0, 0], [0.16, 0, 0], [0, 0.1, 0], [0.16, 0.1, 0], [0.08, 0.05, 0.07]].forEach(([dx, dy, dz]) => {
      s += box(x + dx, y + dy, z + dz, 0.15, 0.09, 0.07, '#E57357');
    });
    return s;
  }
  function scaffold(x, y, z, w, d, h) {
    const C = '#B07B4F', L = (a, b) => seg(iso(...a), iso(...b), C, 2);
    let s = '';
    const levels = [z + h * 0.35, z + h * 0.7, z + h];
    // back frame
    s += L([x, y, z], [x, y, z + h]) + L([x + w, y, z], [x + w, y, z + h]) + L([x, y + d, z], [x, y + d, z + h]);
    levels.forEach((lz) => { s += L([x, y, lz], [x + w, y, lz]) + L([x, y, lz], [x, y + d, lz]); });
    // planks on the middle level
    s += flat(x, y, x + w, y + d, levels[1], 'rgba(198,139,89,.55)', { stroke: C, sw: 1 });
    // front frame + braces
    levels.forEach((lz) => { s += L([x, y + d, lz], [x + w, y + d, lz]) + L([x + w, y, lz], [x + w, y + d, lz]); });
    s += L([x, y + d, z], [x + w, y + d, z + h * 0.7]) + L([x + w, y, z], [x + w, y + d, z + h * 0.7]);
    s += L([x + w / 2, y + d, z], [x + w / 2, y + d, z + h]) + L([x + w, y + d / 2, z], [x + w, y + d / 2, z + h]);
    s += L([x + w, y + d, z], [x + w, y + d, z + h]);
    return s;
  }
  function crane(x, y, z, h = 2) {
    const Y = '#FFC72C';
    let s = box(x, y, z, 0.1, 0.1, h, Y, { sw: 0.8 });
    s += box(x, y - 0.35, z + h, 0.08, 1.75, 0.07, Y, { sw: 0.8 });
    const hook = [x + 0.04, y + 1.15];
    s += seg(iso(hook[0], hook[1], z + h), iso(hook[0], hook[1], z + h - 0.75), '#455A64', 1);
    s += box(hook[0] - 0.09, hook[1] - 0.09, z + h - 0.95, 0.18, 0.18, 0.18, '#E57357', { sw: 0.8 });
    return s;
  }

  /* ----------------------------------------------------------------- ground */
  function plot(x = 0, y = 0, w = 3, d = 3, color = '#8ED16F') {
    let s = box(x, y, 0, w, d, G, color, { left: '#B98A5E', right: '#9C7049', top: color });
    // grass tufts
    const tufts = [[0.3, 0.6], [2.6, 0.4], [0.5, 2.2], [2.3, 2.7], [1.4, 0.25], [2.8, 1.6]];
    tufts.forEach(([tx, ty]) => {
      if (tx > w || ty > d) return;
      const [cx, cy] = iso(x + tx, y + ty, G);
      s += `<path d="M${cx - 3},${cy}l1.5,-3.5l1.5,3.5l1.5,-3l1.5,3" fill="none" stroke="${darken(color, 0.18)}" stroke-width="1" stroke-linejoin="round" opacity=".7"/>`;
    });
    return s;
  }

  /* --------------------------------------------------------- svg plumbing */
  const DEFS = `<defs>
<linearGradient id="iso-cyl" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#1e2a3b" stop-opacity=".3"/></linearGradient>
<radialGradient id="iso-sph" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#1e2a3b" stop-opacity=".25"/></radialGradient>
<radialGradient id="iso-glow"><stop offset="0" stop-color="#FFE082" stop-opacity=".95"/><stop offset=".4" stop-color="#FFD54F" stop-opacity=".45"/><stop offset="1" stop-color="#FFD54F" stop-opacity="0"/></radialGradient>
<linearGradient id="iso-beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFF8E1" stop-opacity=".7"/><stop offset="1" stop-color="#FFF8E1" stop-opacity="0"/></linearGradient>
</defs>`;
  /** Put this once per page (gradients are shared by id). */
  const defsSvg = () => `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${DEFS}</svg>`;
  const svg = (viewBox, inner, o = {}) =>
    `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" role="img"${o.label ? ` aria-label="${o.label}"` : ''}${o.cls ? ` class="${o.cls}"` : ''}>${inner}</svg>`;

  root.SozqalaIso = {
    TW, TH, ZU, G, OUTLINE, iso, rnd, mix, lighten, darken, shades,
    poly, circle, seg, box, flat, onLeft, onRight, win, windowRow, door, ftext,
    pyramid, gable, cylinder, cone, dome, disc, ball,
    tree, bush, flowers, lamp, bench, fountain, flag, bunting, sparkle, crate, bricks, scaffold, crane,
    plot, defsSvg, svg,
  };
})(typeof window !== 'undefined' ? window : globalThis);
