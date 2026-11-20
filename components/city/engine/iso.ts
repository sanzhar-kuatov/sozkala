/**
 * СӨЗҚАЛА isometric SVG engine — primitives (TypeScript port of design/iso/iso-engine.js).
 *
 * Pure functions that return SVG markup strings; no DOM, so they run on the
 * server and in tests. Output is byte-identical to the Stage 0 prototype
 * (tests/city-engine.test.ts), except that text is now XML-escaped.
 *
 * World axes:  x → screen down-right,  y → screen down-left,  z → up.
 * 1 grid unit = a 64×32 px diamond (2:1 dimetric), 1 height unit = 34 px.
 * Light from the top-left: top faces lightest, +y ("left") faces base colour,
 * +x ("right") faces darkest. Callers emit shapes back-to-front (painter's algorithm).
 */

export type Pt = [number, number];

export type Opts = {
  stroke?: string | false;
  sw?: number;
  opacity?: number;
  cls?: string;
  style?: string;
  /** box(): override face colours */
  left?: string;
  right?: string;
  top?: string;
  /** seg(): dash pattern */
  dash?: string;
};

export const TW = 64;
export const TH = 32;
export const ZU = 34;
const HW = TW / 2;
const HH = TH / 2;
/** Top of a plot's ground slab. */
export const G = 0.2;
export const OUTLINE = "rgba(30,42,59,0.30)";
const NS = 'vector-effect="non-scaling-stroke"';

export const rnd = (n: number) => Math.round(n * 100) / 100;
export const iso = (x: number, y: number, z = 0): Pt => [rnd((x - y) * HW), rnd((x + y) * HH - z * ZU)];
const P = (arr: Pt[]) => arr.map((p) => p.join(",")).join(" ");

/** Escapes text for use inside SVG/XML content and attributes. */
export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/* ------------------------------------------------------------------ colour */
function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbToHex = (c: number[]) =>
  "#" +
  c
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
export const mix = (a: string, b: string, t: number) => {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
};
export const lighten = (c: string, t: number) => mix(c, "#ffffff", t);
export const darken = (c: string, t: number) => mix(c, "#1e2a3b", t);
export const shades = (c: string) => ({ top: lighten(c, 0.22), left: c, right: darken(c, 0.2) });

/* -------------------------------------------------------------- primitives */
function attrs(o: Opts) {
  let s = "";
  if (o.stroke !== false) s += ` stroke="${o.stroke || OUTLINE}" stroke-width="${o.sw || 1}" stroke-linejoin="round"`;
  if (o.opacity != null) s += ` opacity="${o.opacity}"`;
  if (o.cls) s += ` class="${o.cls}"`;
  if (o.style) s += ` style="${o.style}"`;
  return s;
}
export const poly = (pts: Pt[], fill: string, o: Opts = {}) =>
  `<polygon points="${P(pts)}" fill="${fill}"${attrs(o)}/>`;
export const circle = (cx: number, cy: number, r: number, fill: string, o: Opts = {}) =>
  `<circle cx="${rnd(cx)}" cy="${rnd(cy)}" r="${rnd(r)}" fill="${fill}"${attrs(o)}/>`;
export const seg = (a: Pt, b: Pt, color: string, w = 2, o: Opts = {}) =>
  `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}${o.cls ? ` class="${o.cls}"` : ""}${o.opacity != null ? ` opacity="${o.opacity}"` : ""}/>`;

/** Axis-aligned box. Emits the two visible side faces and the top. */
export function box(x: number, y: number, z: number, w: number, d: number, h: number, color: string, o: Opts = {}) {
  const s = shades(color);
  const left = [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
  const right = [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)];
  const top = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
  return poly(left, o.left || s.left, o) + poly(right, o.right || s.right, o) + poly(top, o.top || s.top, o);
}

/** Flat rectangle lying on the plane z (paths, water, plazas). */
export const flat = (x1: number, y1: number, x2: number, y2: number, z: number, fill: string, o: Opts = {}) =>
  poly([iso(x1, y1, z), iso(x2, y1, z), iso(x2, y2, z), iso(x1, y2, z)], fill, Object.assign({ stroke: false }, o));

/* ---------------------------------------------------- drawing ON a wall face
   Content is authored in local face units: u → along the wall, v ↓ from the
   wall top. Strokes inside must use vector-effect="non-scaling-stroke".     */

/** Wall facing +y (screen lower-left). u runs +x from x0. */
export function onLeft(yF: number, x0: number, zTop: number, inner: string) {
  const [sx, sy] = iso(x0, yF, zTop);
  return `<g transform="matrix(${HW},${HH},0,${ZU},${sx},${sy})">${inner}</g>`;
}
/** Wall facing +x (screen lower-right). u runs −y from y0 (the near edge). */
export function onRight(xF: number, y0: number, zTop: number, inner: string) {
  const [sx, sy] = iso(xF, y0, zTop);
  return `<g transform="matrix(${HW},${-HH},0,${ZU},${sx},${sy})">${inner}</g>`;
}

export type WinOpts = { arch?: boolean; lit?: boolean; frame?: string; glass?: string; mullion?: boolean };

/** Window in face units. */
export function win(u: number, v: number, w: number, h: number, o: WinOpts = {}) {
  const glass = o.lit ? "#FFE48A" : o.glass || "#BDE7FF";
  const frame = o.frame || "#FFFFFF";
  const shape = (p: number, fill: string, extra = "") =>
    o.arch
      ? `<path d="M${rnd(u - p)},${rnd(v + h + p)}V${rnd(v + w / 2)}A${rnd(w / 2 + p)},${rnd(w / 2 + p)} 0 0 1 ${rnd(u + w + p)},${rnd(v + w / 2)}V${rnd(v + h + p)}Z" fill="${fill}" ${extra}/>`
      : `<rect x="${rnd(u - p)}" y="${rnd(v - p)}" width="${rnd(w + 2 * p)}" height="${rnd(h + 2 * p)}" fill="${fill}" ${extra}/>`;
  let s = "";
  if (o.lit) s += shape(0.09, "#FFD54F", 'opacity="0.4" class="iso-pulse"');
  s += shape(0.045, frame, `stroke="${OUTLINE}" stroke-width="1" ${NS}`);
  s += shape(0, glass);
  if (!o.lit)
    s += `<path d="M${rnd(u + w * 0.2)},${rnd(v + h * 0.75)}L${rnd(u + w * 0.7)},${rnd(v + h * 0.3)}" stroke="#fff" stroke-opacity=".75" stroke-width="1.3" ${NS}/>`;
  if (o.mullion) {
    s += `<path d="M${rnd(u + w / 2)},${rnd(v)}V${rnd(v + h)}M${rnd(u)},${rnd(v + h * 0.58)}H${rnd(u + w)}" stroke="${frame}" stroke-width="1.4" ${NS}/>`;
  }
  return s;
}
export function windowRow(n: number, u0: number, u1: number, v: number, w: number, h: number, o?: WinOpts) {
  const gap = (u1 - u0 - n * w) / (n + 1);
  let s = "";
  for (let i = 0; i < n; i++) s += win(u0 + gap + i * (w + gap), v, w, h, o);
  return s;
}
/** Door in face units. */
export function door(
  u: number,
  v: number,
  w: number,
  h: number,
  o: { arch?: boolean; color?: string; lit?: boolean } = {},
) {
  const c = o.color || "#7A4B2A";
  const d = o.arch
    ? `M${rnd(u)},${rnd(v + h)}V${rnd(v + w / 2)}A${rnd(w / 2)},${rnd(w / 2)} 0 0 1 ${rnd(u + w)},${rnd(v + w / 2)}V${rnd(v + h)}Z`
    : `M${rnd(u)},${rnd(v + h)}V${rnd(v)}H${rnd(u + w)}V${rnd(v + h)}Z`;
  let s = "";
  if (o.lit)
    s += `<path d="${d}" fill="#FFD54F" opacity=".45" transform="translate(${rnd(u + w / 2)},${rnd(v + h)}) scale(1.35) translate(${rnd(-(u + w / 2))},${rnd(-(v + h))})" class="iso-pulse"/>`;
  s += `<path d="${d}" fill="${c}" stroke="${OUTLINE}" stroke-width="1" ${NS}/>`;
  s += `<path d="M${rnd(u + w / 2)},${rnd(v + (o.arch ? w * 0.25 : 0.04))}V${rnd(v + h)}" stroke="${darken(c, 0.25)}" stroke-width="1" ${NS}/>`;
  s += `<circle cx="${rnd(u + w * 0.38)}" cy="${rnd(v + h * 0.6)}" r="0.022" fill="#FFC72C"/>`;
  return s;
}
/** Text painted on a face (signs, letter tiles). The text is XML-escaped. */
export const ftext = (u: number, v: number, str: string, size: number, fill: string, o: { weight?: number } = {}) =>
  `<text x="${u}" y="${v}" font-size="${size}" font-family="Rubik, Nunito, sans-serif" font-weight="${o.weight || 700}" text-anchor="middle" dominant-baseline="central" fill="${fill}">${esc(str)}</text>`;

/* ------------------------------------------------------------------- roofs */
export function pyramid(x: number, y: number, z: number, w: number, d: number, h: number, color: string, o: Opts = {}) {
  const s = shades(color);
  const a = iso(x + w / 2, y + d / 2, z + h);
  const A = iso(x, y, z);
  const B = iso(x + w, y, z);
  const C = iso(x + w, y + d, z);
  const D = iso(x, y + d, z);
  return (
    poly([A, B, a], darken(color, 0.05), o) +
    poly([D, A, a], lighten(color, 0.12), o) +
    poly([D, C, a], s.left, o) +
    poly([B, C, a], s.right, o)
  );
}
/** Gable roof. axis 'x' → ridge along x, triangular end on the right face;
    axis 'y' → ridge along y, triangular end (pediment) on the left face. */
export function gable(
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  color: string,
  axis: "x" | "y" = "x",
  o: Opts & { wall?: string } = {},
) {
  const s = shades(color);
  const wall = o.wall || color;
  if (axis === "x") {
    const ym = y + d / 2;
    return (
      poly([iso(x, y, z), iso(x + w, y, z), iso(x + w, ym, z + h), iso(x, ym, z + h)], s.top, o) +
      poly([iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, ym, z + h), iso(x, ym, z + h)], s.left, o) +
      poly([iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, ym, z + h)], shades(wall).right, o)
    );
  }
  const xm = x + w / 2;
  return (
    poly([iso(x, y, z), iso(x, y + d, z), iso(xm, y + d, z + h), iso(xm, y, z + h)], s.top, o) +
    poly([iso(x + w, y, z), iso(x + w, y + d, z), iso(xm, y + d, z + h), iso(xm, y, z + h)], s.right, o) +
    poly([iso(x, y + d, z), iso(x + w, y + d, z), iso(xm, y + d, z + h)], wall, o)
  );
}

/* -------------------------------------------------------- round primitives */
const ell = (x: number, y: number, z: number, r: number) => {
  const [cx, cy] = iso(x, y, z);
  return { cx, cy, rx: rnd(r * Math.SQRT2 * HW), ry: rnd(r * Math.SQRT2 * HH) };
};

export function cylinder(x: number, y: number, z: number, r: number, h: number, color: string, o: Opts = {}) {
  const b = ell(x, y, z, r);
  const t = ell(x, y, z + h, r);
  const side = `M${rnd(b.cx - b.rx)},${t.cy}L${rnd(b.cx - b.rx)},${b.cy}A${b.rx},${b.ry} 0 0 0 ${rnd(b.cx + b.rx)},${b.cy}L${rnd(b.cx + b.rx)},${t.cy}Z`;
  return (
    `<path d="${side}" fill="${color}"${attrs(o)}/><path d="${side}" fill="url(#iso-cyl)"/>` +
    `<ellipse cx="${t.cx}" cy="${t.cy}" rx="${t.rx}" ry="${t.ry}" fill="${o.top || lighten(color, 0.22)}"${attrs(o)}/>`
  );
}
export function cone(x: number, y: number, z: number, r: number, h: number, color: string, o: Opts = {}) {
  const b = ell(x, y, z, r);
  const [ax, ay] = iso(x, y, z + h);
  const d = `M${rnd(b.cx - b.rx)},${b.cy}L${ax},${ay}L${rnd(b.cx + b.rx)},${b.cy}A${b.rx},${b.ry} 0 0 1 ${rnd(b.cx - b.rx)},${b.cy}Z`;
  return `<path d="${d}" fill="${color}"${attrs(o)}/><path d="${d}" fill="url(#iso-cyl)"/>`;
}
export function dome(x: number, y: number, z: number, r: number, h: number, color: string, o: Opts = {}) {
  const b = ell(x, y, z, r);
  const hp = rnd(h * ZU);
  const d = `M${rnd(b.cx - b.rx)},${b.cy}A${b.rx},${hp} 0 0 1 ${rnd(b.cx + b.rx)},${b.cy}A${b.rx},${b.ry} 0 0 1 ${rnd(b.cx - b.rx)},${b.cy}Z`;
  return `<path d="${d}" fill="${color}"${attrs(o)}/><path d="${d}" fill="url(#iso-sph)"/>`;
}
export const disc = (x: number, y: number, z: number, r: number, fill: string, o: Opts = {}) => {
  const e = ell(x, y, z, r);
  return `<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}" fill="${fill}"${attrs(o)}/>`;
};
/** Screen-space ball (foliage, ornaments). r in px. */
export const ball = (cx: number, cy: number, r: number, color: string, o: Opts = {}) =>
  circle(cx, cy, r, color, o) + circle(cx, cy, r, "url(#iso-sph)", { stroke: false });

/* -------------------------------------------------------------- decoration */
export function tree(x: number, y: number, z = G, s = 1, kind: "round" | "pine" = "round", color = "#5DBB63") {
  const out = cylinder(x, y, z, 0.05 * s, 0.32 * s, "#8D5A3B", { stroke: false });
  if (kind === "pine") {
    return (
      out +
      cone(x, y, z + 0.18 * s, 0.3 * s, 0.6 * s, darken(color, 0.12)) +
      cone(x, y, z + 0.5 * s, 0.22 * s, 0.5 * s, color)
    );
  }
  const [cx, cy] = iso(x, y, z + 0.6 * s);
  const R = 12 * s;
  return (
    out +
    ball(cx - R * 0.45, cy + R * 0.3, R * 0.72, darken(color, 0.1)) +
    ball(cx, cy, R, color) +
    ball(cx + R * 0.45, cy - R * 0.25, R * 0.55, lighten(color, 0.15), { stroke: false })
  );
}
export function bush(x: number, y: number, z = G, s = 1, color = "#4CAF50") {
  const [cx, cy] = iso(x, y, z + 0.1 * s);
  return ball(cx - 4 * s, cy, 6 * s, darken(color, 0.06)) + ball(cx + 4 * s, cy - 1, 6.5 * s, color);
}
export function flowers(x: number, y: number, z = G, colors = ["#FF6B9A", "#FFC72C", "#FFFFFF", "#B388FF"]) {
  const [cx, cy] = iso(x, y, z);
  const spots = [
    [-7, 0],
    [-2, -3],
    [4, -1],
    [8, 2],
    [1, 3],
    [-5, 4],
  ];
  return (
    ball(cx, cy + 1, 9, "#6FB552", { stroke: false }) +
    spots.map(([dx, dy], i) => circle(cx + dx, cy + dy - 2, 2.4, colors[i % colors.length], { stroke: false })).join("")
  );
}
export function lamp(x: number, y: number, z = G, lit = false, h = 0.75) {
  const a = iso(x, y, z);
  const t = iso(x, y, z + h);
  let s = seg(a, t, "#37474F", 2);
  if (lit) s += circle(t[0], t[1], 16, "url(#iso-glow)", { stroke: false, cls: "iso-pulse" });
  s += circle(t[0], t[1] - 1, 3.6, lit ? "#FFF3B0" : "#ECEFF1", { stroke: "#37474F", sw: 1 });
  return s;
}
export function bench(x: number, y: number, z = G, color = "#C68B59") {
  return (
    box(x, y, z + 0.1, 0.4, 0.12, 0.04, color) +
    box(x, y, z + 0.14, 0.4, 0.03, 0.16, darken(color, 0.1)) +
    seg(iso(x + 0.03, y + 0.1, z), iso(x + 0.03, y + 0.1, z + 0.1), "#455A64", 1.5) +
    seg(iso(x + 0.37, y + 0.1, z), iso(x + 0.37, y + 0.1, z + 0.1), "#455A64", 1.5)
  );
}
export function fountain(x: number, y: number, z = G, r = 0.3) {
  let s = cylinder(x, y, z, r, 0.12, "#D5DEE6");
  s += disc(x, y, z + 0.12, r * 0.84, "#5BC8F5", { stroke: false });
  s += cylinder(x, y, z + 0.12, r * 0.13, 0.3, "#E3EAF0");
  s += cylinder(x, y, z + 0.42, r * 0.42, 0.05, "#D5DEE6");
  const top = iso(x, y, z + 0.7);
  s += seg(iso(x, y, z + 0.47), top, "#E1F5FE", 2, { cls: "iso-spray" });
  for (const a of [0.3, 1.9, 3.5, 5.1]) {
    const e = iso(x + r * 0.62 * Math.cos(a), y + r * 0.62 * Math.sin(a), z + 0.13);
    const c = [rnd((top[0] + e[0]) / 2 + (e[0] - top[0]) * 0.35), rnd(top[1] - 8)];
    s += `<path d="M${top[0]},${top[1]}Q${c[0]},${c[1]} ${e[0]},${e[1]}" fill="none" stroke="#E1F5FE" stroke-width="1.6" class="iso-spray"/>`;
  }
  return s;
}
export function flag(x: number, y: number, z: number, h = 0.4, color = "#FFC72C") {
  const a = iso(x, y, z);
  const t = iso(x, y, z + h);
  return (
    seg(a, t, "#455A64", 1.4) + poly([t, [t[0] + 14, t[1] + 4], [t[0], t[1] + 9]], color, { cls: "iso-flag", sw: 0.8 })
  );
}
/** Bunting / string lights between two screen points. */
export function bunting(a: Pt, b: Pt, colors: string[], lights = false) {
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 9];
  let s = `<path d="M${a[0]},${a[1]}Q${mid[0]},${mid[1]} ${b[0]},${b[1]}" fill="none" stroke="#546E7A" stroke-width="1"/>`;
  const n = 7;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const it = 1 - t;
    const px = it * it * a[0] + 2 * it * t * mid[0] + t * t * b[0];
    const py = it * it * a[1] + 2 * it * t * mid[1] + t * t * b[1];
    s += lights
      ? circle(px, py + 1.5, 2.2, "#FFE082", {
          stroke: false,
          cls: "iso-pulse",
          style: `animation-delay:${i * 0.25}s`,
        }) + circle(px, py + 1.5, 6, "url(#iso-glow)", { stroke: false })
      : poly(
          [
            [px - 3, py],
            [px + 3, py],
            [px, py + 6],
          ],
          colors[i % colors.length],
          { stroke: false },
        );
  }
  return s;
}
export function sparkle(cx: number, cy: number, s = 6, delay = 0, color = "#FFF6C2") {
  return `<path d="M${cx},${cy - s}Q${cx},${cy} ${cx + s},${cy}Q${cx},${cy} ${cx},${cy + s}Q${cx},${cy} ${cx - s},${cy}Q${cx},${cy} ${cx},${cy - s}Z" fill="${color}" stroke="#FFC72C" stroke-width=".6" class="iso-twinkle" style="animation-delay:${delay}s"/>`;
}
export const crate = (x: number, y: number, z = G, s = 0.25) =>
  box(x, y, z, s, s, s, "#C68B59") +
  seg(iso(x, y + s, z), iso(x + s, y + s, z + s), "#8D5A3B", 1) +
  seg(iso(x + s, y, z), iso(x + s, y + s, z + s), "#8D5A3B", 1);
export function bricks(x: number, y: number, z = G) {
  let s = "";
  for (const [dx, dy, dz] of [
    [0, 0, 0],
    [0.16, 0, 0],
    [0, 0.1, 0],
    [0.16, 0.1, 0],
    [0.08, 0.05, 0.07],
  ]) {
    s += box(x + dx, y + dy, z + dz, 0.15, 0.09, 0.07, "#E57357");
  }
  return s;
}
type V3 = [number, number, number];
export function scaffold(x: number, y: number, z: number, w: number, d: number, h: number) {
  const C = "#B07B4F";
  const L = (a: V3, b: V3) => seg(iso(...a), iso(...b), C, 2);
  let s = "";
  const levels = [z + h * 0.35, z + h * 0.7, z + h];
  // back frame
  s += L([x, y, z], [x, y, z + h]) + L([x + w, y, z], [x + w, y, z + h]) + L([x, y + d, z], [x, y + d, z + h]);
  levels.forEach((lz) => {
    s += L([x, y, lz], [x + w, y, lz]) + L([x, y, lz], [x, y + d, lz]);
  });
  // planks on the middle level
  s += flat(x, y, x + w, y + d, levels[1], "rgba(198,139,89,.55)", { stroke: C, sw: 1 });
  // front frame + braces
  levels.forEach((lz) => {
    s += L([x, y + d, lz], [x + w, y + d, lz]) + L([x + w, y, lz], [x + w, y + d, lz]);
  });
  s += L([x, y + d, z], [x + w, y + d, z + h * 0.7]) + L([x + w, y, z], [x + w, y + d, z + h * 0.7]);
  s += L([x + w / 2, y + d, z], [x + w / 2, y + d, z + h]) + L([x + w, y + d / 2, z], [x + w, y + d / 2, z + h]);
  s += L([x + w, y + d, z], [x + w, y + d, z + h]);
  return s;
}
export function crane(x: number, y: number, z: number, h = 2) {
  const Y = "#FFC72C";
  let s = box(x, y, z, 0.1, 0.1, h, Y, { sw: 0.8 });
  s += box(x, y - 0.35, z + h, 0.08, 1.75, 0.07, Y, { sw: 0.8 });
  const hook = [x + 0.04, y + 1.15];
  s += seg(iso(hook[0], hook[1], z + h), iso(hook[0], hook[1], z + h - 0.75), "#455A64", 1);
  s += box(hook[0] - 0.09, hook[1] - 0.09, z + h - 0.95, 0.18, 0.18, 0.18, "#E57357", { sw: 0.8 });
  return s;
}

/* ------------------------------------------------------------------- ground */
export function plot(x = 0, y = 0, w = 3, d = 3, color = "#8ED16F") {
  let s = box(x, y, 0, w, d, G, color, { left: "#B98A5E", right: "#9C7049", top: color });
  // grass tufts
  const tufts = [
    [0.3, 0.6],
    [2.6, 0.4],
    [0.5, 2.2],
    [2.3, 2.7],
    [1.4, 0.25],
    [2.8, 1.6],
  ];
  for (const [tx, ty] of tufts) {
    if (tx > w || ty > d) continue;
    const [cx, cy] = iso(x + tx, y + ty, G);
    s += `<path d="M${cx - 3},${cy}l1.5,-3.5l1.5,3.5l1.5,-3l1.5,3" fill="none" stroke="${darken(color, 0.18)}" stroke-width="1" stroke-linejoin="round" opacity=".7"/>`;
  }
  return s;
}

/* ----------------------------------------------------------- svg plumbing */
/** Shared gradients (referenced by id). Included in every SVG we render. */
export const DEFS = `<defs>
<linearGradient id="iso-cyl" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#1e2a3b" stop-opacity=".3"/></linearGradient>
<radialGradient id="iso-sph" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#1e2a3b" stop-opacity=".25"/></radialGradient>
<radialGradient id="iso-glow"><stop offset="0" stop-color="#FFE082" stop-opacity=".95"/><stop offset=".4" stop-color="#FFD54F" stop-opacity=".45"/><stop offset="1" stop-color="#FFD54F" stop-opacity="0"/></radialGradient>
<linearGradient id="iso-beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFF8E1" stop-opacity=".7"/><stop offset="1" stop-color="#FFF8E1" stop-opacity="0"/></linearGradient>
</defs>`;

export const svg = (viewBox: string, inner: string, o: { label?: string; cls?: string } = {}) =>
  `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" role="img"${o.label ? ` aria-label="${esc(o.label)}"` : ""}${o.cls ? ` class="${o.cls}"` : ""}>${inner}</svg>`;
