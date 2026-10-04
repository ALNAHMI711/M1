/**
 * FibSync - DynamicFibSupport
 *
 * Static Fibonacci levels (0.236, 0.382, 0.5, 0.618, 0.786) between the lowest low and the highest high of the last
 * `n` bars, and dynamic Fibonacci levels between the last confirmed swing low and swing high. A swing high (low) is a
 * bar whose high (low) is the highest (lowest) of the `swing_len` bars on each side; it is confirmed `swing_len`
 * bars later and its price is kept until the next swing. The dynamic levels are drawn once both swings exist.
 *
 * Reference: "FibSync - DynamicFibSupport" by mr_uponly
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © der chartmeister, © bakeTheCrypto, © mr_uponly
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface FibsyncDynamicfibsupportInputs {
  /** Window of the static levels (highest high / lowest low) */
  n: number;
  /** Show the dynamic levels */
  showDynamic: boolean;
  /** Search window of the most recent swing high / low */
  dynLookback: number;
  /** Swing strength: bars on each side of a swing */
  swingLen: number;
}

export const defaultInputs: FibsyncDynamicfibsupportInputs = {
  n: 250,
  showDynamic: true,
  dynLookback: 200,
  swingLen: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'n', type: 'int', title: 'Static Fib Period', defval: 250 },
  { id: 'showDynamic', type: 'bool', title: 'Show Dynamic Fibonacci Levels', defval: true },
  { id: 'dynLookback', type: 'int', title: 'Dynamic Fib Swing Search Window', defval: 200 },
  { id: 'swingLen', type: 'int', title: 'Swing Strength (bars left/right)', defval: 10 },
];

const YELLOW = String(color.new(color.yellow, 0));
const RED = String(color.new(color.red, 0));
const BLUE = String(color.new(color.blue, 0));
const GREEN = String(color.new(color.green, 0));
const GRAY = String(color.new(color.gray, 0));
const WHITE = String(color.new(color.white, 0));
const YELLOW50 = String(color.new(color.yellow, 50));
const RED50 = String(color.new(color.red, 50));
const BLUE50 = String(color.new(color.blue, 50));
const GRAY50 = String(color.new(color.gray, 50));
const GREEN50 = String(color.new(color.green, 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'p1 0.236', color: YELLOW, lineWidth: 1 },
  { id: 'plot1', title: 'p2 0.382', color: RED, lineWidth: 1 },
  { id: 'plot2', title: 'p4 0.618', color: BLUE, lineWidth: 1 },
  { id: 'plot3', title: 'p5 0.786', color: GREEN, lineWidth: 1 },
  { id: 'plot4', title: 'p3 0.5', color: GRAY, lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Lowest', color: GREEN, lineWidth: 2, display: 'none' },
  { id: 'plot6', title: 'Highest', color: RED, lineWidth: 2, display: 'none' },
  { id: 'plot7', title: 'Close', color: WHITE, lineWidth: 1, display: 'none' },
  { id: 'plot8', title: 'Dynamic 0.236', color: YELLOW50, lineWidth: 1, style: 'linebr' },
  { id: 'plot9', title: 'Dynamic 0.382', color: RED50, lineWidth: 1, style: 'linebr' },
  { id: 'plot10', title: 'Dynamic 0.618', color: BLUE50, lineWidth: 1, style: 'linebr' },
  { id: 'plot11', title: 'Dynamic 0.5', color: GRAY50, lineWidth: 1, style: 'linebr', display: 'none' },
  { id: 'plot12', title: 'Dynamic 0.786', color: GREEN50, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'FibSync - DynamicFibSupport',
  shortTitle: 'FibSync - DynamicFibSupport',
  overlay: true,
};

/** Pine `==` on floats: equal within 1e-10 (na compares false) */
const eq = (a: number, b: number) => Math.abs(a - b) <= 1e-10;

export function calculate(bars: Bar[], inputs: Partial<FibsyncDynamicfibsupportInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const highS = Series.fromArray(bars, high);
  const lowS = Series.fromArray(bars, low);

  // Static levels
  const hh = A(ta.highest(highS, cfg.n));
  const ll = A(ta.lowest(lowS, cfg.n));

  // Swings: high[swing_len] == ta.highest(high, swing_len * 2 + 1)
  const sl = cfg.swingLen;
  const winHigh = A(ta.highest(highS, sl * 2 + 1));
  const winLow = A(ta.lowest(lowS, sl * 2 + 1));
  const swingHigh: number[] = new Array(n);
  const swingLow: number[] = new Array(n);
  let sh = NaN;
  let slo = NaN;
  for (let i = 0; i < n; i++) {
    const hBack = i - sl >= 0 ? high[i - sl] : NaN;
    const lBack = i - sl >= 0 ? low[i - sl] : NaN;
    sh = eq(hBack, winHigh[i]) ? hBack : sh;
    slo = eq(lBack, winLow[i]) ? lBack : slo;
    swingHigh[i] = sh;
    swingLow[i] = slo;
  }

  // for i = 0 to dyn_lookback: the first non-na swing_high_price[i]
  const recent = (arr: number[], i: number) => {
    for (let k = 0; k <= cfg.dynLookback; k++) {
      if (i - k < 0) break;
      if (!isNaN(arr[i - k])) return arr[i - k];
    }
    return NaN;
  };

  const plots: Record<string, { time: number; value: number; color: string }[]> = {};
  for (let p = 0; p <= 12; p++) plots[`plot${p}`] = [];
  const colours = [YELLOW, RED, BLUE, GREEN, GRAY, GREEN, RED, WHITE, YELLOW50, RED50, BLUE50, GRAY50, GREEN50];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time as number;
    const range = hh[i] - ll[i];
    const p1 = ll[i] + range * 0.236;
    const p2 = ll[i] + range * 0.382;
    const p3 = ll[i] + range * 0.5;
    const p4 = ll[i] + range * 0.618;
    const p5 = ll[i] + range * 0.786;

    const rsh = recent(swingHigh, i);
    const rsl = recent(swingLow, i);
    let d236 = NaN;
    let d382 = NaN;
    let d500 = NaN;
    let d618 = NaN;
    let d786 = NaN;
    if (!isNaN(rsh) && !isNaN(rsl)) {
      const fibRange = rsh - rsl;
      d236 = rsl + fibRange * 0.236;
      d382 = rsl + fibRange * 0.382;
      d500 = rsl + fibRange * 0.5;
      d618 = rsl + fibRange * 0.618;
      d786 = rsl + fibRange * 0.786;
    }
    const dyn = (v: number) => (cfg.showDynamic ? v : NaN);
    const values = [p1, p2, p4, p5, p3, ll[i], hh[i], bars[i].close,
      dyn(d236), dyn(d382), dyn(d618), dyn(d500), dyn(d786)];
    values.forEach((v, p) => plots[`plot${p}`].push({ time: t, value: v, color: colours[p] }));
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const FibsyncDynamicfibsupport = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
