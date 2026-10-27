/*
 * Lightweight PPTX → positioned slide model.
 * Resolves slide → layout → master → theme so backgrounds, decorative shapes,
 * placeholder positions and text styles are inherited the way PowerPoint does.
 * Coordinates are in stage pixels (EMU / 9525) so the viewer can render the
 * slide at its native size and scale the whole stage uniformly.
 * Not pixel-perfect: charts, SmartArt, tables, EMF/WMF pictures, effects and
 * most preset shapes beyond rect / roundRect / ellipse / custom paths are approximated or skipped.
 */

export type Fill =
  | { kind: 'none' }
  | { kind: 'solid'; color: string }
  | { kind: 'grad'; stops: { pos: number; color: string }[]; angle: number }
  | { kind: 'image'; src: string; tile: boolean };

export type Run = { text: string; sizePt: number; bold: boolean; italic: boolean; underline: boolean; color: string; font: string; br?: boolean };
export type Paragraph = { align: 'left' | 'center' | 'right' | 'justify'; marL: number; indent: number; bullet: string | null; runs: Run[]; emptySizePt: number; lineSpacing: number | null; spaceBefore: number; spaceAfter: number };
export type TextBody = { anchor: 'top' | 'middle' | 'bottom'; insets: [number, number, number, number]; wrap: boolean; scale: number; paragraphs: Paragraph[]; vertical: boolean };
export type Geometry = { kind: 'rect' } | { kind: 'roundRect'; radius: number } | { kind: 'ellipse' } | { kind: 'path'; d: string; vw: number; vh: number };
export type SlideElement = {
  id: string; x: number; y: number; w: number; h: number; rot: number; flipH: boolean; flipV: boolean;
  geom: Geometry; fill: Fill; line: { color: string; width: number; dash: boolean } | null;
  image?: { src: string; crop: [number, number, number, number] };
  text?: TextBody; layer: 'master' | 'layout' | 'slide';
};
export type ParsedSlide = { background: Fill; elements: SlideElement[]; skipped: number; path: string };
export type ParsedDeck = { width: number; height: number; ratio: number; slides: ParsedSlide[]; urls: string[]; fonts: string[] };

const EMU_PX = 9525;
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/* ---------- XML helpers (namespace-prefix tolerant, direct children only) ---------- */
const local = (el: Element) => el.localName || el.nodeName.replace(/^.*:/, '');
function kids(el: Element | null | undefined, name?: string): Element[] {
  if (!el) return [];
  return (Array.from(el.childNodes) as Element[]).filter((c) => c.nodeType === 1 && (!name || local(c) === name));
}
function kid(el: Element | null | undefined, name: string): Element | undefined { return kids(el, name)[0]; }
function path(el: Element | null | undefined, ...names: string[]): Element | undefined {
  let cur: Element | undefined = el ?? undefined;
  for (const n of names) { cur = kid(cur, n); if (!cur) return undefined; }
  return cur;
}
function attrNum(el: Element | null | undefined, name: string): number | undefined {
  const v = at(el, name);
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
/** getAttribute that returns null for absent attributes in every DOM implementation. */
function at(el: Element | null | undefined, name: string): string | null { return el && el.hasAttribute(name) ? el.getAttribute(name) : null; }
function rid(el: Element | undefined, name: string) { return el?.getAttributeNS(NS_R, name) || el?.getAttribute(`r:${name}`) || undefined; }

/* ---------- Colors ---------- */
type Theme = { colors: Record<string, string>; major: string; minor: string; fillStyles: Element[]; bgFillStyles: Element[] };
type ClrMap = Record<string, string>;
const PRESET: Record<string, string> = { black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', gray: '808080', grey: '808080', darkGray: 'A9A9A9', lightGray: 'D3D3D3', orange: 'FFA500', navy: '000080', maroon: '800000', purple: '800080' };

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').padStart(6, '0');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min; const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const f = (p: number, q: number, t: number) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q;
  return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
}

type Ctx = { theme: Theme; clrMap: ClrMap; fonts?: Set<string> };
const COLOR_TAGS = ['srgbClr', 'schemeClr', 'sysClr', 'prstClr', 'scrgbClr', 'hslClr'];

/** Reads the first color child of `holder` (e.g. a:solidFill) and applies modifiers. */
function readColor(holder: Element | undefined, ctx: Ctx, phClr?: string): string | undefined {
  const c = kids(holder).find((k) => COLOR_TAGS.includes(local(k)));
  if (!c) return undefined;
  let hex: string | undefined;
  const tag = local(c);
  if (tag === 'srgbClr') hex = c.getAttribute('val') ?? undefined;
  else if (tag === 'sysClr') hex = c.getAttribute('lastClr') ?? (c.getAttribute('val') === 'window' ? 'FFFFFF' : '000000');
  else if (tag === 'prstClr') hex = PRESET[c.getAttribute('val') ?? ''];
  else if (tag === 'scrgbClr') hex = [attrNum(c, 'r'), attrNum(c, 'g'), attrNum(c, 'b')].map((v) => Math.round(((v ?? 0) / 100000) * 255).toString(16).padStart(2, '0')).join('');
  else if (tag === 'schemeClr') {
    const v = c.getAttribute('val') ?? '';
    if (v === 'phClr') hex = phClr?.replace('#', '');
    else hex = ctx.theme.colors[ctx.clrMap[v] ?? v];
  }
  if (!hex) return undefined;
  let [r, g, b] = hexToRgb(hex);
  let alpha = 1;
  for (const m of kids(c)) {
    const v = (attrNum(m, 'val') ?? 0) / 100000;
    const n = local(m);
    if (n === 'alpha') alpha = v;
    else if (n === 'tint') { r = r + (255 - r) * (1 - v); g = g + (255 - g) * (1 - v); b = b + (255 - b) * (1 - v); }
    else if (n === 'shade') { r *= v; g *= v; b *= v; }
    else if (n === 'lumMod' || n === 'lumOff' || n === 'satMod') {
      const [h, s, l] = rgbToHsl(r, g, b);
      const nl = n === 'lumMod' ? l * v : n === 'lumOff' ? l + v : l;
      const ns = n === 'satMod' ? s * v : s;
      [r, g, b] = hslToRgb(h, Math.min(1, Math.max(0, ns)), Math.min(1, Math.max(0, nl)));
    }
  }
  const cl = (x: number) => Math.round(Math.min(255, Math.max(0, x)));
  return alpha < 1 ? `rgba(${cl(r)},${cl(g)},${cl(b)},${alpha.toFixed(3)})` : `rgb(${cl(r)},${cl(g)},${cl(b)})`;
}

/* ---------- Package parts ---------- */
type Part = { path: string; doc: Element; rels: Map<string, { target: string; type: string }> };

function resolvePath(base: string, target: string) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const seg of target.split('/')) { if (seg === '..') parts.pop(); else if (seg && seg !== '.') parts.push(seg); }
  return parts.join('/');
}

type Zip = { file: (p: string) => { async: (t: 'text' | 'blob') => Promise<any> } | null; files: Record<string, unknown> };

async function loadPart(zip: Zip, parser: DOMParser, p: string, cache: Map<string, Part | null>): Promise<Part | null> {
  if (cache.has(p)) return cache.get(p)!;
  const xml = await zip.file(p)?.async('text');
  if (!xml) { cache.set(p, null); return null; }
  const doc = parser.parseFromString(xml as string, 'application/xml').documentElement;
  const rels = new Map<string, { target: string; type: string }>();
  const relsPath = p.replace(/([^/]+)$/, '_rels/$1.rels');
  const relsXml = await zip.file(relsPath)?.async('text');
  if (relsXml) {
    for (const r of Array.from(parser.parseFromString(relsXml as string, 'application/xml').getElementsByTagName('Relationship'))) {
      if (r.getAttribute('TargetMode') === 'External') continue;
      rels.set(r.getAttribute('Id') ?? '', { target: resolvePath(p, r.getAttribute('Target') ?? ''), type: r.getAttribute('Type') ?? '' });
    }
  }
  const part = { path: p, doc, rels };
  cache.set(p, part);
  return part;
}
const relOfType = (part: Part | null, suffix: string) => part ? Array.from(part.rels.values()).find((r) => r.type.endsWith(suffix))?.target : undefined;

function parseTheme(part: Part | null): Theme {
  const theme: Theme = { colors: { dk1: '000000', lt1: 'FFFFFF', dk2: '1F497D', lt2: 'EEECE1', accent1: '4F81BD', accent2: 'C0504D', accent3: '9BBB59', accent4: '8064A2', accent5: '4BACC6', accent6: 'F79646', hlink: '0000FF', folHlink: '800080' }, major: 'Calibri Light', minor: 'Calibri', fillStyles: [], bgFillStyles: [] };
  const el = part?.doc ? path(part.doc, 'themeElements') : undefined;
  if (!el) return theme;
  for (const c of kids(kid(el, 'clrScheme'))) {
    const v = kid(c, 'srgbClr')?.getAttribute('val') ?? kid(c, 'sysClr')?.getAttribute('lastClr');
    if (v) theme.colors[local(c)] = v;
  }
  theme.major = path(el, 'fontScheme', 'majorFont', 'latin')?.getAttribute('typeface') || theme.major;
  theme.minor = path(el, 'fontScheme', 'minorFont', 'latin')?.getAttribute('typeface') || theme.minor;
  theme.fillStyles = kids(path(el, 'fmtScheme', 'fillStyleLst'));
  theme.bgFillStyles = kids(path(el, 'fmtScheme', 'bgFillStyleLst'));
  return theme;
}

/* ---------- Deck parse ---------- */
type Env = { zip: Zip; parser: DOMParser; parts: Map<string, Part | null>; images: Map<string, string | null>; urls: string[]; fonts: Set<string> };

async function imageUrl(env: Env, target: string | undefined): Promise<string | null> {
  if (!target) return null;
  if (env.images.has(target)) return env.images.get(target)!;
  const file = env.zip.file(target);
  let url: string | null = null;
  if (file && /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(target)) {
    const data = (await file.async('blob')) as Blob;
    const type = /\.svg$/i.test(target) ? 'image/svg+xml' : /\.png$/i.test(target) ? 'image/png' : /\.jpe?g$/i.test(target) ? 'image/jpeg' : /\.gif$/i.test(target) ? 'image/gif' : /\.webp$/i.test(target) ? 'image/webp' : 'image/bmp';
    url = URL.createObjectURL(new Blob([data], { type }));
    env.urls.push(url);
  }
  env.images.set(target, url);
  return url;
}

async function readFill(spPr: Element | undefined, ctx: Ctx, part: Part, env: Env, phClr?: string): Promise<Fill | undefined> {
  if (!spPr) return undefined;
  for (const c of kids(spPr)) {
    const n = local(c);
    if (n === 'noFill') return { kind: 'none' };
    if (n === 'solidFill') { const color = readColor(c, ctx, phClr); return color ? { kind: 'solid', color } : undefined; }
    if (n === 'gradFill') {
      const stops = kids(kid(c, 'gsLst'), 'gs').map((g) => ({ pos: (attrNum(g, 'pos') ?? 0) / 1000, color: readColor(g, ctx, phClr) ?? 'transparent' })).sort((a, b) => a.pos - b.pos);
      const ang = attrNum(kid(c, 'lin'), 'ang');
      if (stops.length) return { kind: 'grad', stops, angle: ang != null ? ang / 60000 : 90 };
    }
    if (n === 'blipFill') {
      const src = await imageUrl(env, part.rels.get(rid(kid(c, 'blip'), 'embed') ?? '')?.target);
      if (src) return { kind: 'image', src, tile: !!kid(c, 'tile') };
      return undefined;
    }
    if (n === 'pattFill') { const color = readColor(kid(c, 'bgClr'), ctx, phClr) ?? readColor(kid(c, 'fgClr'), ctx, phClr); return color ? { kind: 'solid', color } : undefined; }
  }
  return undefined;
}

async function readBackground(part: Part | null, ctx: Ctx, env: Env): Promise<Fill | undefined> {
  const bg = part ? path(part.doc, 'cSld', 'bg') : undefined;
  if (!bg || !part) return undefined;
  const bgPr = kid(bg, 'bgPr');
  if (bgPr) return readFill(bgPr, ctx, part, env);
  const ref = kid(bg, 'bgRef');
  if (ref) {
    const idx = attrNum(ref, 'idx') ?? 0;
    const color = readColor(ref, ctx);
    const style = idx >= 1001 ? ctx.theme.bgFillStyles[idx - 1001] : idx > 0 ? ctx.theme.fillStyles[idx - 1] : undefined;
    if (style) {
      const wrap = { childNodes: [style] } as unknown as Element;
      // Theme styles reference images via the theme part; images there are rare, so colors are the target.
      const f = await readFill(wrap, ctx, part, env, color);
      if (f) return f;
    }
    if (color) return { kind: 'solid', color };
  }
  return undefined;
}

/* ---------- Placeholders & text styles ---------- */
type Ph = { type: string; idx: string | null };
function phOf(sp: Element): Ph | null {
  const nv = kids(sp).find((k) => /^nv.*Pr$/.test(local(k)));
  const ph = path(nv, 'nvPr', 'ph');
  if (!ph) return null;
  return { type: at(ph, 'type') ?? 'body', idx: at(ph, 'idx') };
}
const titleLike = (t: string) => t === 'title' || t === 'ctrTitle';
function findPh(part: Part | null, ph: Ph, byTypeOnly = false): Element | undefined {
  if (!part) return undefined;
  const all = Array.from(part.doc.getElementsByTagName('*')).filter((e) => local(e) === 'sp' && phOf(e));
  if (!byTypeOnly && ph.idx != null) { const m = all.find((e) => phOf(e)!.idx === ph.idx); if (m) return m; }
  const exact = all.find((e) => phOf(e)!.type === ph.type);
  if (exact) return exact;
  if (titleLike(ph.type)) return all.find((e) => titleLike(phOf(e)!.type));
  if (ph.type === 'subTitle' || ph.type === 'obj') return all.find((e) => phOf(e)!.type === 'body');
  return undefined;
}

type Level = { algn?: string; marL?: number; indent?: number; bullet?: string | null; sz?: number; b?: boolean; i?: boolean; u?: boolean; color?: string; font?: string; lnSpc?: number; spcBef?: number; spcAft?: number };
function readLevel(pPr: Element | undefined, ctx: Ctx, phClr?: string): Level {
  const out: Level = {};
  if (!pPr) return out;
  const algn = at(pPr, 'algn'); if (algn) out.algn = algn;
  const marL = attrNum(pPr, 'marL'); if (marL != null) out.marL = marL / EMU_PX;
  const ind = attrNum(pPr, 'indent'); if (ind != null) out.indent = ind / EMU_PX;
  if (kid(pPr, 'buNone')) out.bullet = null;
  const bu = kid(pPr, 'buChar'); if (bu) out.bullet = bu.getAttribute('char') ?? '•';
  if (kid(pPr, 'buAutoNum')) out.bullet = '•';
  const ln = path(pPr, 'lnSpc', 'spcPct'); if (ln) out.lnSpc = (attrNum(ln, 'val') ?? 100000) / 100000;
  const sb = path(pPr, 'spcBef', 'spcPts'); if (sb) out.spcBef = (attrNum(sb, 'val') ?? 0) / 100;
  const sa = path(pPr, 'spcAft', 'spcPts'); if (sa) out.spcAft = (attrNum(sa, 'val') ?? 0) / 100;
  Object.assign(out, readRun(kid(pPr, 'defRPr'), ctx, phClr));
  return out;
}
function readRun(rPr: Element | undefined, ctx: Ctx, phClr?: string): Level {
  const out: Level = {};
  if (!rPr) return out;
  const sz = attrNum(rPr, 'sz'); if (sz != null) out.sz = sz / 100;
  const b = at(rPr, 'b'); if (b != null) out.b = b === '1' || b === 'true';
  const i = at(rPr, 'i'); if (i != null) out.i = i === '1' || i === 'true';
  const u = at(rPr, 'u'); if (u != null) out.u = u !== 'none';
  const color = readColor(kid(rPr, 'solidFill'), ctx, phClr); if (color) out.color = color;
  const font = kid(rPr, 'latin')?.getAttribute('typeface'); if (font) out.font = font;
  return out;
}
const lvlOf = (lst: Element | undefined, lvl: number) => kid(lst, `lvl${lvl + 1}pPr`);

function fontName(f: string | undefined, ctx: Ctx) {
  if (!f || f === '+mn-lt' || f === '+mn-ea' || f === '+mn-cs') return ctx.theme.minor;
  if (f === '+mj-lt' || f === '+mj-ea' || f === '+mj-cs') return ctx.theme.major;
  return f;
}

/* ---------- Shapes ---------- */
type Xf = { x: number; y: number; w: number; h: number; rot: number; flipH: boolean; flipV: boolean };
function readXfrm(el: Element | undefined): Xf | null {
  const xfrm = el ? (kid(el, 'xfrm') ?? kid(kid(el, 'spPr'), 'xfrm')) : undefined;
  const off = kid(xfrm, 'off'); const ext = kid(xfrm, 'ext');
  if (!off || !ext) return null;
  return { x: (attrNum(off, 'x') ?? 0) / EMU_PX, y: (attrNum(off, 'y') ?? 0) / EMU_PX, w: (attrNum(ext, 'cx') ?? 0) / EMU_PX, h: (attrNum(ext, 'cy') ?? 0) / EMU_PX, rot: (attrNum(xfrm, 'rot') ?? 0) / 60000, flipH: xfrm!.getAttribute('flipH') === '1', flipV: xfrm!.getAttribute('flipV') === '1' };
}
type GroupMap = (x: Xf) => Xf;
const identity: GroupMap = (x) => x;

function readGeom(spPr: Element | undefined, w: number, h: number): Geometry {
  const prst = kid(spPr, 'prstGeom');
  if (prst) {
    const t = prst.getAttribute('prst');
    if (t === 'ellipse' || t === 'circle') return { kind: 'ellipse' };
    if (t === 'roundRect' || t === 'round2SameRect' || t === 'snipRoundRect') {
      const adj = kids(kid(prst, 'avLst'), 'gd')[0]?.getAttribute('fmla')?.match(/val\s+(\d+)/)?.[1];
      return { kind: 'roundRect', radius: Math.min(w, h) * (adj ? Number(adj) / 100000 : 0.16667) };
    }
    const tri: Record<string, string> = { triangle: 'M50 0 L100 100 L0 100 Z', rtTriangle: 'M0 0 L100 100 L0 100 Z', diamond: 'M50 0 L100 50 L50 100 L0 50 Z', parallelogram: 'M25 0 L100 0 L75 100 L0 100 Z', trapezoid: 'M25 0 L75 0 L100 100 L0 100 Z', rightArrow: 'M0 25 L70 25 L70 0 L100 50 L70 100 L70 75 L0 75 Z', leftArrow: 'M100 25 L30 25 L30 0 L0 50 L30 100 L30 75 L100 75 Z', chevron: 'M0 0 L75 0 L100 50 L75 100 L0 100 L25 50 Z', homePlate: 'M0 0 L80 0 L100 50 L80 100 L0 100 Z', hexagon: 'M25 0 L75 0 L100 50 L75 100 L25 100 L0 50 Z', pentagon: 'M50 0 L100 38 L81 100 L19 100 L0 38 Z' };
    if (t && tri[t]) return { kind: 'path', d: tri[t], vw: 100, vh: 100 };
    return { kind: 'rect' };
  }
  const cust = kid(spPr, 'custGeom');
  const p = kids(kid(cust, 'pathLst'), 'path')[0];
  if (p) {
    const vw = attrNum(p, 'w') || w * EMU_PX; const vh = attrNum(p, 'h') || h * EMU_PX;
    let d = '';
    const pt = (e: Element) => `${attrNum(e, 'x') ?? 0} ${attrNum(e, 'y') ?? 0}`;
    for (const c of kids(p)) {
      const n = local(c); const pts = kids(c, 'pt');
      if (n === 'moveTo' && pts[0]) d += `M${pt(pts[0])} `;
      else if (n === 'lnTo' && pts[0]) d += `L${pt(pts[0])} `;
      else if (n === 'cubicBezTo' && pts.length === 3) d += `C${pts.map(pt).join(' ')} `;
      else if (n === 'quadBezTo' && pts.length === 2) d += `Q${pts.map(pt).join(' ')} `;
      else if (n === 'close') d += 'Z ';
    }
    if (d) return { kind: 'path', d, vw, vh };
  }
  return { kind: 'rect' };
}

type Chain = { slide?: Element; layout?: Element; master?: Element; masterPart: Part | null };

async function buildShape(sp: Element, part: Part, ctx: Ctx, env: Env, map: GroupMap, layer: SlideElement['layer'], chain: Chain, out: SlideElement[], counter: { n: number; skipped: number }) {
  const ph = phOf(sp);
  // Placeholders on layouts/masters are prompts, never drawn.
  if (ph && layer !== 'slide') return;
  const layoutPh = ph ? findPh(chain.layout ? { doc: chain.layout } as Part : null, ph) : undefined;
  const masterPh = ph ? findPh(chain.master ? { doc: chain.master } as Part : null, ph, true) ?? (layoutPh ? findPh({ doc: chain.master! } as Part, phOf(layoutPh)!, true) : undefined) : undefined;
  const spPr = kid(sp, 'spPr');
  const xf = readXfrm(sp) ?? readXfrm(layoutPh) ?? readXfrm(masterPh);
  if (!xf) return;
  const m = map(xf);
  const style = kid(sp, 'style');
  const styleFill = readColor(kid(style, 'fillRef'), ctx);
  const fill = (await readFill(spPr, ctx, part, env)) ?? (await readFill(kid(layoutPh, 'spPr'), ctx, part, env)) ?? ((attrNum(kid(style, 'fillRef'), 'idx') ?? 0) > 0 && styleFill ? { kind: 'solid', color: styleFill } as Fill : { kind: 'none' } as Fill);
  const ln = kid(spPr, 'ln');
  let line: SlideElement['line'] = null;
  if (ln && !kid(ln, 'noFill')) {
    const color = readColor(kid(ln, 'solidFill'), ctx);
    if (color) line = { color, width: Math.max(0.75, (attrNum(ln, 'w') ?? 9525) / EMU_PX), dash: !!kid(ln, 'prstDash') && kid(ln, 'prstDash')!.getAttribute('val') !== 'solid' };
  } else if (!ln && (attrNum(kid(style, 'lnRef'), 'idx') ?? 0) > 0) {
    const color = readColor(kid(style, 'lnRef'), ctx);
    if (color) line = { color, width: 1, dash: false };
  }
  const el: SlideElement = { id: `e${counter.n++}`, ...m, geom: readGeom(spPr, m.w, m.h), fill, line, layer };
  const txBody = kid(sp, 'txBody');
  if (txBody) {
    const text = readText(txBody, ph, layoutPh, masterPh, chain, ctx, readColor(kid(style, 'fontRef'), ctx));
    if (text) el.text = text;
  }
  if (fill.kind === 'none' && !line && !el.text) return;
  out.push(el);
}

function readText(txBody: Element, ph: Ph | null, layoutPh: Element | undefined, masterPh: Element | undefined, chain: Chain, ctx: Ctx, styleColor?: string): TextBody | undefined {
  const paras = kids(txBody, 'p');
  if (!paras.some((p) => kids(p).some((r) => (local(r) === 'r' || local(r) === 'fld') && (kid(r, 't')?.textContent ?? '') !== ''))) return undefined;
  const txStyles = path(chain.master, 'txStyles');
  const base = ph ? (titleLike(ph.type) ? kid(txStyles, 'titleStyle') : ['body', 'obj', 'subTitle'].includes(ph.type) || !ph.type ? kid(txStyles, 'bodyStyle') : kid(txStyles, 'otherStyle')) : kid(txStyles, 'otherStyle');
  const lists = [base, kid(kid(masterPh, 'txBody'), 'lstStyle'), kid(kid(layoutPh, 'txBody'), 'lstStyle'), kid(txBody, 'lstStyle')];
  const bodyPrs = [kid(kid(masterPh, 'txBody'), 'bodyPr'), kid(kid(layoutPh, 'txBody'), 'bodyPr'), kid(txBody, 'bodyPr')];
  const bp = (name: string) => { let v: string | null = null; for (const b of bodyPrs) { const a = at(b, name); if (a != null) v = a; } return v; };
  const ins = (name: string, d: number) => { const v = bp(name); return (v != null ? Number(v) : d) / EMU_PX; };
  const anchorRaw = bp('anchor');
  const autofit = kid(kid(txBody, 'bodyPr'), 'normAutofit');
  const scale = autofit ? (attrNum(autofit, 'fontScale') ?? 100000) / 100000 : 1;
  const lnRed = autofit ? (attrNum(autofit, 'lnSpcReduction') ?? 0) / 100000 : 0;
  const isTitle = !!ph && titleLike(ph.type);
  const tx1 = `#${ctx.theme.colors[ctx.clrMap.tx1 ?? 'dk1'] ?? '000000'}`;
  const paragraphs: Paragraph[] = paras.map((p) => {
    const pPr = kid(p, 'pPr');
    const lvl = Math.min(8, attrNum(pPr, 'lvl') ?? 0);
    const merged: Level = { sz: 18, color: styleColor ?? tx1, font: isTitle ? '+mj-lt' : '+mn-lt', bullet: null };
    for (const l of lists) Object.assign(merged, readLevel(lvlOf(l, lvl), ctx));
    if (!ph) merged.bullet = null;
    Object.assign(merged, readLevel(pPr, ctx));
    const runs: Run[] = [];
    for (const r of kids(p)) {
      const n = local(r);
      if (n === 'br') { runs.push({ text: '', br: true, sizePt: (merged.sz ?? 18) * scale, bold: false, italic: false, underline: false, color: merged.color!, font: '' }); continue; }
      if (n !== 'r' && n !== 'fld') continue;
      const rl = { ...merged, ...readRun(kid(r, 'rPr'), ctx) };
      const font = fontName(rl.font, ctx);
      ctx.fonts?.add(font);
      runs.push({ text: kid(r, 't')?.textContent ?? '', sizePt: (rl.sz ?? 18) * scale, bold: !!rl.b, italic: !!rl.i, underline: !!rl.u, color: rl.color ?? tx1, font });
    }
    const end = readRun(kid(p, 'endParaRPr'), ctx);
    const algn = merged.algn;
    return {
      align: algn === 'ctr' ? 'center' : algn === 'r' ? 'right' : algn === 'just' || algn === 'dist' ? 'justify' : 'left',
      marL: merged.marL ?? 0, indent: merged.indent ?? 0,
      bullet: runs.length && merged.bullet ? merged.bullet : null,
      runs, emptySizePt: (end.sz ?? merged.sz ?? 18) * scale,
      lineSpacing: merged.lnSpc != null ? Math.max(0.6, merged.lnSpc - lnRed) : lnRed ? 1 - lnRed : null,
      spaceBefore: merged.spcBef ?? 0, spaceAfter: merged.spcAft ?? 0,
    };
  });
  return {
    anchor: anchorRaw === 'ctr' ? 'middle' : anchorRaw === 'b' ? 'bottom' : anchorRaw === 't' ? 'top' : isTitle && ph?.type === 'ctrTitle' ? 'bottom' : 'top',
    insets: [ins('tIns', 45720), ins('rIns', 91440), ins('bIns', 45720), ins('lIns', 91440)],
    wrap: bp('wrap') !== 'none', scale, paragraphs, vertical: /^vert/.test(bp('vert') ?? 'horz') && bp('vert') !== 'horz',
  };
}

async function walkTree(tree: Element | undefined, part: Part, ctx: Ctx, env: Env, map: GroupMap, layer: SlideElement['layer'], chain: Chain, out: SlideElement[], counter: { n: number; skipped: number }) {
  for (const node of kids(tree)) {
    const n = local(node);
    if (n === 'sp' || n === 'cxnSp') await buildShape(node, part, ctx, env, map, layer, chain, out, counter);
    else if (n === 'pic') {
      const xf = readXfrm(node) ?? (() => { const ph = phOf(node); return ph ? readXfrm(findPh(chain.layout ? { doc: chain.layout } as Part : null, ph)) : null; })();
      const blipFill = kid(node, 'blipFill');
      const target = part.rels.get(rid(kid(blipFill, 'blip'), 'embed') ?? '')?.target;
      const src = await imageUrl(env, target);
      if (!xf || !src) { counter.skipped += 1; continue; }
      const sr = kid(blipFill, 'srcRect');
      const crop: [number, number, number, number] = [attrNum(sr, 'l') ?? 0, attrNum(sr, 't') ?? 0, attrNum(sr, 'r') ?? 0, attrNum(sr, 'b') ?? 0].map((v) => v / 100000) as [number, number, number, number];
      const ln = kid(kid(node, 'spPr'), 'ln');
      const lc = ln ? readColor(kid(ln, 'solidFill'), ctx) : undefined;
      out.push({ id: `e${counter.n++}`, ...map(xf), geom: readGeom(kid(node, 'spPr'), xf.w, xf.h), fill: { kind: 'none' }, line: lc ? { color: lc, width: Math.max(0.75, (attrNum(ln, 'w') ?? 9525) / EMU_PX), dash: false } : null, image: { src, crop }, layer });
    } else if (n === 'grpSp') {
      const gx = kid(kid(node, 'grpSpPr'), 'xfrm');
      const off = kid(gx, 'off'); const ext = kid(gx, 'ext'); const chOff = kid(gx, 'chOff'); const chExt = kid(gx, 'chExt');
      let inner = map;
      if (off && ext && chOff && chExt) {
        const ox = (attrNum(off, 'x') ?? 0) / EMU_PX, oy = (attrNum(off, 'y') ?? 0) / EMU_PX;
        const cx = (attrNum(chOff, 'x') ?? 0) / EMU_PX, cy = (attrNum(chOff, 'y') ?? 0) / EMU_PX;
        const sx = (attrNum(ext, 'cx') ?? 1) / (attrNum(chExt, 'cx') || 1), sy = (attrNum(ext, 'cy') ?? 1) / (attrNum(chExt, 'cy') || 1);
        inner = (x) => map({ ...x, x: ox + (x.x - cx) * sx, y: oy + (x.y - cy) * sy, w: x.w * sx, h: x.h * sy });
      }
      await walkTree(node, part, ctx, env, inner, layer, chain, out, counter);
    } else if (n === 'graphicFrame' || n === 'AlternateContent') counter.skipped += 1;
  }
}

export async function parsePptx(blob: Blob): Promise<ParsedDeck> {
  const JSZip = (await import('jszip')).default;
  const zip = (await JSZip.loadAsync(await blob.arrayBuffer())) as unknown as Zip;
  const env: Env = { zip, parser: new DOMParser(), parts: new Map(), images: new Map(), urls: [], fonts: new Set() };
  try {
    const pres = await loadPart(zip, env.parser, 'ppt/presentation.xml', env.parts);
    const size = pres ? kid(pres.doc, 'sldSz') : undefined;
    const cx = attrNum(size, 'cx') || 12192000; const cy = attrNum(size, 'cy') || 6858000;
    // Presentation order comes from sldIdLst, not file names.
    let order = kids(kid(pres?.doc, 'sldIdLst'), 'sldId').map((s) => pres!.rels.get(rid(s, 'id') ?? '')?.target).filter((t): t is string => !!t && !!zip.file(t));
    if (!order.length) {
      order = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
    }
    const slides: ParsedSlide[] = [];
    for (const sPath of order) {
      const slide = await loadPart(zip, env.parser, sPath, env.parts);
      if (!slide) continue;
      const layout = await loadPart(zip, env.parser, relOfType(slide, '/slideLayout') ?? '', env.parts);
      const master = await loadPart(zip, env.parser, relOfType(layout, '/slideMaster') ?? '', env.parts);
      const theme = parseTheme(await loadPart(zip, env.parser, relOfType(master, '/theme') ?? '', env.parts));
      const clrMap: ClrMap = { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' };
      const cm = master ? kid(master.doc, 'clrMap') : undefined;
      for (const a of Array.from(cm?.attributes ?? [])) clrMap[a.name] = a.value;
      const ov = path(slide.doc, 'clrMapOvr', 'overrideClrMapping') ?? path(layout?.doc, 'clrMapOvr', 'overrideClrMapping');
      for (const a of Array.from(ov?.attributes ?? [])) clrMap[a.name] = a.value;
      const ctx: Ctx = { theme, clrMap, fonts: env.fonts };
      const chain: Chain = { slide: slide.doc, layout: layout?.doc, master: master?.doc, masterPart: master };
      const background = (await readBackground(slide, ctx, env)) ?? (await readBackground(layout, ctx, env)) ?? (await readBackground(master, ctx, env)) ?? { kind: 'solid', color: `#${theme.colors[clrMap.bg1 ?? 'lt1'] ?? 'FFFFFF'}` };
      const elements: SlideElement[] = [];
      const counter = { n: 0, skipped: 0 };
      const showMaster = (p: Part | null) => p?.doc.getAttribute('showMasterSp') !== '0';
      if (master && showMaster(slide) && showMaster(layout)) await walkTree(path(master.doc, 'cSld', 'spTree'), master, ctx, env, identity, 'master', chain, elements, { n: counter.n, skipped: 0 }).then(() => { counter.n += 1000; });
      if (layout && showMaster(slide)) await walkTree(path(layout.doc, 'cSld', 'spTree'), layout, ctx, env, identity, 'layout', chain, elements, { n: counter.n, skipped: 0 }).then(() => { counter.n += 1000; });
      await walkTree(path(slide.doc, 'cSld', 'spTree'), slide, ctx, env, identity, 'slide', chain, elements, counter);
      elements.forEach((e, i) => { e.id = `s${slides.length}-${i}`; });
      slides.push({ background, elements, skipped: counter.skipped, path: sPath });
    }
    return { width: cx / EMU_PX, height: cy / EMU_PX, ratio: cx / cy, slides, urls: env.urls, fonts: Array.from(env.fonts) };
  } catch (e) {
    env.urls.forEach((u) => URL.revokeObjectURL(u));
    throw e;
  }
}
