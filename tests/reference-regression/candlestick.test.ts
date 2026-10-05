/**
 * Reference regression of the candlestick patterns: every reference run (dataset x input variant) of the 45
 * candlestick scripts must stay equal: detection bars of each alert, the labels the reference keeps (bar, text, style,
 * colour, tooltip), the background colours and the alertcondition titles / messages. From bar 0 on daily datasets,
 * from bar 300 on intraday datasets (the reference was computed on hidden earlier bars). Local data (README.md).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { executeScript } from 'oakscriptjs/script';
import { candlestickPortEntries, candlestickPortAllPatterns } from '../../src/candlestick-port/adapter';
import { ALL_PATTERNS } from '../../src/candlestick-port/registry';
import { patternScript } from '../../src/candlestick-port/pattern-runner';
import { allPatternsScript } from '../../src/candlestick-port/all-patterns';
import { DATA_DIR, loadBars } from './compare';

interface Run {
  dataset: string; variant: string; bars: string; times_count: number; start: number; n: number;
  alerts: [string, string | null][];
  detect: { title: string; key: [string, string] | null; bars: number[] }[];
  labels: { bar: number; text: string; shape: string; color: string; textcolor: string; tooltip: string | null }[];
  bg: { offset: number; bars: [number, string][] } | null;
}

const dir = join(DATA_DIR, 'candlestick');
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json.gz')).sort() : [];

const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ports = new Map<string, { indicator: any; body: () => any }>();
ALL_PATTERNS.forEach((def: any, i: number) => {
  ports.set(slugOf(def.name), { indicator: candlestickPortEntries[i].indicator, body: () => patternScript(def) });
});
ports.set('all-patterns', { indicator: candlestickPortAllPatterns.indicator, body: allPatternsScript as () => any });

const TREND: Record<string, string> = { sma200: 'SMA50, SMA200', notrend: 'No detection' };
function inputsFor(slug: string, variant: string): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};
  const parts = variant.split('_');
  for (const p of parts) if (TREND[p]) inputs.detect_trend_based_on = TREND[p];
  if (slug === 'all-patterns' && ['allon', 'bull', 'bear'].includes(parts[0])) {
    for (const c of candlestickPortAllPatterns.indicator.inputConfig) if (c.type === 'bool') inputs[c.id] = true;
    if (parts[0] === 'bull') inputs.pattern_type = 'Bullish';
    if (parts[0] === 'bear') inputs.pattern_type = 'Bearish';
  }
  return inputs;
}

/** rgba() of the candlestick check script: channels truncated, alpha round(a * 255) (half to even) */
function rgba(c: string | null | undefined): number[] | null {
  if (c === null || c === undefined) return null;
  const s = c.trim();
  let m = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(s);
  if (m) return [0, 2, 4].map((k) => parseInt(m![1].slice(k, k + 2), 16)).concat(parseInt(m[2] ?? 'ff', 16));
  m = /^rgba?\(([^)]*)\)$/.exec(s);
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x));
    const a = (p.length > 3 ? p[3] : 1) * 255;
    const f = Math.floor(a);
    const r = a - f > 0.5 ? f + 1 : a - f < 0.5 ? f : (f % 2 === 0 ? f : f + 1);
    return [Math.trunc(p[0]), Math.trunc(p[1]), Math.trunc(p[2]), r];
  }
  throw new Error(`colour ${c}`);
}
function sameColour(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = rgba(a), y = rgba(b);
  if (x === null || y === null) return x === y;
  return x[0] === y[0] && x[1] === y[1] && x[2] === y[2] && Math.abs(x[3] - y[3]) <= 1;
}

function checkRun(slug: string, run: Run): string[] {
  const port = ports.get(slug);
  if (!port) return [`no port for ${slug}`];
  const bars = loadBars(run.bars);
  if (bars.length !== run.times_count) return [`bar count ${bars.length}, reference ${run.times_count}`];
  const inputs = inputsFor(slug, run.variant);
  const res = port.indicator.calculate(bars, inputs);
  const raw = executeScript(port.body as never, bars as never, inputs as never) as any;
  const tooltips: (string | null)[] = (raw.result.markers ?? []).map((mk: any) => mk.tooltip ?? null);
  const markers = (res.markers as any[]).map((mk, i) => ({ ...mk, tooltip: tooltips[i] }));
  const t2i = new Map(bars.map((b, i) => [b.time, i]));
  const { start, n } = run;
  const diffs: string[] = [];

  const alerts = (raw.alertConfig as any[]).map((a) => [a.title, a.message ?? null]);
  if (JSON.stringify(alerts) !== JSON.stringify(run.alerts)) diffs.push('alerts differ');

  const byKey = new Map<string, Set<number>>();
  for (const mk of markers) {
    const k = `${mk.text}|${mk.shape}`;
    if (!byKey.has(k)) byKey.set(k, new Set());
    byKey.get(k)!.add(t2i.get(mk.time)!);
  }
  for (const d of run.detect) {
    let pb: Set<number>;
    if (d.key === null) {
      pb = new Set(markers.map((mk) => t2i.get(mk.time)!).filter((i) => i < n));
    } else {
      const k = `${d.key[0]}|${d.key[1]}`;
      if (!byKey.has(k)) continue; // no port marker: none on both, or a pattern the inputs do not show
      pb = new Set([...byKey.get(k)!].filter((i) => i < n));
    }
    const refBars = new Set(d.bars);
    const late = [...new Set([...refBars, ...pb])].filter((i) => (refBars.has(i) !== pb.has(i)) && i >= start);
    if (late.length) diffs.push(`detect ${d.title}: ${late.length} bars differ, first ${late.sort((a, b) => a - b).slice(0, 3)}`);
  }

  const tl = run.labels;
  let pm = markers.map((mk, k) => ({ i: t2i.get(mk.time)!, k, mk })).sort((a, b) => a.i - b.i || a.k - b.k)
    .filter((x) => x.i >= start && x.i < n).map((x) => x.mk);
  pm = tl.length ? pm.slice(-tl.length) : [];
  if (tl.length !== pm.length) diffs.push(`labels: ${tl.length} reference, ${pm.length} port`);
  tl.forEach((a, j) => {
    const b = pm[j];
    if (!b) return;
    if (a.bar !== t2i.get(b.time) || a.text !== b.text || a.shape !== b.shape || (a.tooltip ?? null) !== (b.tooltip ?? null)
      || !sameColour(a.color, b.color) || !sameColour(a.textcolor, '#ffffff')) diffs.push(`label ${j} (bar ${a.bar}) differs`);
  });

  const portBg = new Map<number, string>();
  for (const b of (res.bgColors ?? []) as { time: number; color: string }[]) {
    const i = t2i.get(b.time);
    if (i !== undefined) portBg.set(i, b.color);
  }
  if (!run.bg) {
    if (portBg.size) diffs.push(`bg: port has ${portBg.size} bars, reference none`);
  } else {
    const refBg = new Map(run.bg.bars);
    const pbg = new Map([...portBg].filter(([i]) => i < n + run.bg!.offset));
    const bad = [...new Set([...refBg.keys(), ...pbg.keys()])].filter((i) => i >= start && !sameColour(refBg.get(i), pbg.get(i)));
    if (bad.length) diffs.push(`bg: ${bad.length} bars differ`);
  }
  return diffs.map((d) => `${run.dataset} @${run.variant}: ${d}`);
}

describe.skipIf(files.length === 0)('Reference regression: candlestick patterns', () => {
  it.each(files.map((f) => f.slice(0, -'.json.gz'.length)))('%s', (slug) => {
    const fx = JSON.parse(gunzipSync(readFileSync(join(dir, `${slug}.json.gz`))).toString('utf-8')) as { runs: Run[] };
    const diffs = fx.runs.flatMap((r) => checkRun(slug, r));
    expect(diffs, `runs that are no longer equal to the reference (${slug})`).toEqual([]);
  });
});
