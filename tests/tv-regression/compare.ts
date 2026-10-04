/**
 * TradingView regression checks.
 *
 * Each fixture (data/fixtures/<id>.json.gz, built from TradingView runs of the Pine source) holds, per dataset, the
 * TradingView outputs already paired with the port outputs (plot values, plot / fill / bar / background / candle
 * colours, gradient fills, markers) and the number of equal bars accepted when the fixture was built. A check fails
 * when the port now gives fewer equal bars (a regression); more equal bars is an improvement.
 *
 * The equality rules are the ones used to build the fixtures:
 * - values: na equals na; numbers equal within 1e-12 or 1e-6 relative; |x| >= 1e99 counts as na
 * - colours: '#RRGGBBAA'; na, 'transparent' and alpha 0 are equal; the alpha may differ by 1
 * - markers: a TradingView shape on bar i is matched by a port marker on bar i + shift with the same shape (when the
 *   series has one) and colour (marker colour, else text colour)
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data');

type Colour = string | null;

interface ValueCheck { kind: 'value'; port: string; tv: string; shift: number; lo: number; hi: number; expected: (number | null)[]; equal: number; total: number }
interface MarkerCheck { tv: string; shape: string | null; shift: number; expected: [number, Colour][]; equal: number; total: number }
interface ColourCheck { kind: string; port: string; tv: string; lo: number; hi: number; expected: Colour[]; equal: number; total: number }
interface GradientCheck { kind: 'value' | 'color'; port: string; field: string; tv: string; lo: number; hi: number; expected: (number | string | null)[]; equal: number; total: number }

export interface FixtureDataset {
  dataset: string;
  bars: string;
  start: number;
  n: number;
  values: ValueCheck[];
  markers: MarkerCheck[];
  colors: ColourCheck[];
  gradients: GradientCheck[];
  extra_markers?: number;
}

export interface Fixture {
  id: string;
  source: string;
  inputs: Record<string, unknown>;
  datasets: FixtureDataset[];
}

export interface CheckResult {
  dataset: string;
  check: string;
  equal: number;
  accepted: number;
  total: number;
}

const gz = (file: string) => JSON.parse(gunzipSync(readFileSync(file)).toString('utf-8'));

export function fixtureIds(): string[] {
  const dir = join(DATA_DIR, 'fixtures');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json.gz')).map((f) => f.slice(0, -'.json.gz'.length)).sort();
}

export const loadFixture = (id: string): Fixture => gz(join(DATA_DIR, 'fixtures', `${id}.json.gz`));

const barsCache = new Map<string, { time: number; open: number; high: number; low: number; close: number; volume: number }[]>();
export function loadBars(file: string) {
  let b = barsCache.get(file);
  if (!b) {
    const raw: number[][] = gz(join(DATA_DIR, 'bars', file));
    b = raw.map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] }));
    barsCache.set(file, b);
  }
  return b;
}

// ---------- equality rules (same as the fixture builder) ----------

function norm(v: unknown): number | null {
  if (typeof v !== 'number') return null;
  return Number.isNaN(v) || Math.abs(v) >= 1e99 ? null : v;
}

function equalValue(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === null && b === null;
  const d = Math.abs(a - b);
  return d <= 1e-12 || d <= 1e-6 * Math.max(Math.abs(a), Math.abs(b));
}

/** Python round(): half to even */
function roundHalfEven(x: number): number {
  const f = Math.floor(x);
  const diff = x - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

const hex2 = (x: number) => x.toString(16).toUpperCase().padStart(2, '0');

/** colour -> '#RRGGBBAA', null for na / transparent / alpha 0, 'INVALID(...)' for a non-colour */
export function cssHex(c: unknown): Colour {
  if (c === null || c === undefined) return null;
  const s = String(c).trim();
  if (s === '' || s === 'transparent' || s === 'na') return null;
  let m = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(s);
  if (m) {
    const a = (m[2] ?? 'FF').toUpperCase();
    return a === '00' ? null : `#${m[1].toUpperCase()}${a}`;
  }
  m = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(s);
  if (m) return `#${m.slice(1, 4).map((x) => x + x).join('').toUpperCase()}FF`;
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*(-?[\d.]+)\s*)?\)$/.exec(s);
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map((x) => roundHalfEven(parseFloat(x)));
    const a = m[4] !== undefined ? Math.floor(parseFloat(m[4]) * 255 + 0.5) : 255;
    if (!(a >= 0 && a <= 255)) return `INVALID(${s})`;
    return a === 0 ? null : `#${hex2(r)}${hex2(g)}${hex2(b)}${hex2(a)}`;
  }
  return `INVALID(${s})`;
}

function closeColour(a: string, b: string): boolean {
  if (a.startsWith('INVALID') || b.startsWith('INVALID')) return a === b;
  return a.slice(0, 7) === b.slice(0, 7) && Math.abs(parseInt(a.slice(7, 9), 16) - parseInt(b.slice(7, 9), 16)) <= 1;
}

function sameColour(port: Colour, tv: Colour): boolean {
  if (tv === null || port === null) return tv === null && port === null;
  return closeColour(port, tv);
}

// ---------- port outputs in the layout of the fixture builder ----------

interface PortOutputs {
  times: number[];
  plots: Record<string, unknown[]>;
  raw: Record<string, any>;
}

/** The port result as the batch tools saved it: a JSON round trip (NaN -> null), plots paired by bar time. */
export function portOutputs(result: unknown, bars: { time: number }[]): PortOutputs {
  const raw = JSON.parse(JSON.stringify(result ?? {}));
  const times = bars.map((b) => b.time);
  const plots: Record<string, unknown[]> = {};
  for (const [id, points] of Object.entries((raw.plots ?? {}) as Record<string, { time: number; value?: unknown; color?: unknown }[]>)) {
    const byT = new Map(points.map((pt) => [pt.time, pt]));
    plots[id] = times.map((t) => {
      const v = byT.get(t)?.value;
      return v === undefined || v === null ? null : v;
    });
    const colours = times.map((t) => byT.get(t)?.color ?? null);
    if (colours.some((c) => c !== null)) plots[`${id}.color`] = colours;
  }
  return { times, plots, raw };
}

function colourStream(out: PortOutputs, name: string): Colour[] {
  const { times, plots, raw } = out;
  const idx = new Map(times.map((t, i) => [t, i]));
  const perBar = (entries: { time: number; color?: unknown }[] | undefined) => {
    const s: Colour[] = new Array(times.length).fill(null);
    for (const e of entries ?? []) {
      const i = idx.get(e.time);
      if (i !== undefined) s[i] = cssHex(e.color);
    }
    return s;
  };
  if (name === 'barColors') return perBar(raw.barColors ?? raw.barcolors);
  if (name === 'bgColors') return perBar(raw.bgColors ?? raw.bgcolors);
  let m = /^fill (\d+)$/.exec(name);
  if (m) {
    const f = (raw.fills ?? [])[Number(m[1])];
    const cols: unknown[] = f?.colors ?? [];
    return times.map((_, i) => (i < cols.length ? cssHex(cols[i]) : null));
  }
  m = /^plotCandles\.(.+)\.(color|wickColor|borderColor)$/.exec(name);
  if (m) {
    const s: Colour[] = new Array(times.length).fill(null);
    for (const e of (raw.plotCandles ?? {})[m[1]] ?? []) {
      const i = idx.get(e.time);
      if (i !== undefined) s[i] = cssHex(e[m[2]] || e.color);
    }
    return s;
  }
  const stream = plots[`${name}.color`];
  return stream ? stream.map(cssHex) : new Array(times.length).fill(null);
}

// ---------- checks ----------

export function runChecks(ds: FixtureDataset, result: unknown, bars: { time: number }[]): CheckResult[] {
  const out = portOutputs(result, bars);
  const res: CheckResult[] = [];
  const add = (check: string, equal: number, accepted: number, total: number) =>
    res.push({ dataset: ds.dataset, check, equal, accepted, total });

  for (const c of ds.values) {
    const pv = out.plots[c.port] ?? [];
    let eq = 0;
    for (let i = c.lo; i < c.hi; i++) if (equalValue(norm(pv[i]), c.expected[i - c.lo])) eq++;
    add(`value ${c.port} <- ${c.tv}${c.shift ? ` (shift ${c.shift})` : ''}`, eq, c.equal, c.total);
  }

  // markers by bar: (shape, colour)
  const idx = new Map(out.times.map((t, i) => [t, i]));
  const pm = new Map<number, { shape: string; colour: Colour }[]>();
  for (const m of (out.raw.markers ?? []) as Record<string, any>[]) {
    const i = idx.get(m.time);
    if (i !== undefined && i >= ds.start && i < ds.n) {
      const colour = cssHex(m.color) ?? cssHex(m.textColor);
      if (!pm.has(i)) pm.set(i, []);
      pm.get(i)!.push({ shape: m.shape, colour });
    }
  }
  const explained = new Set<string>();
  for (const c of ds.markers) {
    let eq = 0;
    for (const [i, colour] of c.expected) {
      const hit = (pm.get(i + c.shift) ?? []).some((p) => (c.shape === null || p.shape === c.shape) && sameColour(p.colour, colour));
      if (hit) {
        eq++;
        explained.add(`${i + c.shift}|${c.shape}`);
      }
    }
    add(`markers ${c.tv}${c.shift ? ` (shift ${c.shift})` : ''}`, eq, c.equal, c.total);
  }
  if (ds.extra_markers !== undefined && pm.size) {
    let extra = 0;
    for (const [i, ps] of pm) for (const p of ps) if (!explained.has(`${i}|${p.shape}`) && !explained.has(`${i}|null`)) extra++;
    // fewer extra markers is better: compared as "bars without an extra marker"
    add('extra markers (port markers no TradingView shape explains)', -extra, -ds.extra_markers, 0);
  }

  for (const c of ds.colors) {
    const s = colourStream(out, c.port);
    let eq = 0;
    for (let i = c.lo; i < c.hi; i++) if (sameColour(s[i], c.expected[i - c.lo])) eq++;
    add(`colour ${c.kind} ${c.tv} -> ${c.port}`, eq, c.equal, c.total);
  }

  for (const c of ds.gradients) {
    const j = Number(/^fill (\d+)$/.exec(c.port)?.[1]);
    const g = ((out.raw.fills ?? [])[j] ?? {}).gradient ?? {};
    const field: unknown[] = g[c.field] ?? [];
    let eq = 0;
    if (c.kind === 'value') {
      for (let i = c.lo; i < c.hi; i++) {
        const a = field[i];
        const b = c.expected[i - c.lo] as number | null;
        const aNa = a === null || a === undefined || (typeof a === 'number' && Number.isNaN(a));
        if (aNa || b === null) {
          if (aNa && b === null) eq++;
        } else if (typeof a === 'number') {
          const d = Math.abs(a - b);
          if (d <= 1e-12 || d <= 1e-6 * Math.max(Math.abs(a), Math.abs(b))) eq++;
        }
      }
    } else {
      const top: unknown[] = g.topValue ?? [];
      const bottom: unknown[] = g.bottomValue ?? [];
      for (let i = c.lo; i < c.hi; i++) {
        const visible = top[i] !== null && top[i] !== undefined && bottom[i] !== null && bottom[i] !== undefined;
        if (visible && sameColour(cssHex(field[i]), c.expected[i - c.lo] as Colour)) eq++;
      }
    }
    add(`gradient ${c.kind} ${c.port}.${c.field} <- ${c.tv}`, eq, c.equal, c.total);
  }
  return res;
}
