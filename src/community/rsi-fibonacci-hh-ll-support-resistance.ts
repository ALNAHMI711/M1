/**
 * Fibonacci HH LL Trend Regularity Adaptive Moving Average Band Ribbon
 *
 * Two trend regularity adaptive moving averages (TRAMA) of the high and of the low: the factor tc is the square of
 * the SMA (over `length` bars) of a flag that is 1 when the `length`-bar highest high rises or the lowest low falls;
 * ama := ama[1] + tc * (price - ama[1]). The midline is their average and the half range dist = (ama high - ama
 * low) / 2. Six levels above and six below the midline at dist times 1.618, 2.618, 3.618, 5.618, 8.618 and 13.618,
 * with fills of decreasing strength toward the midline. The midline is lime when above its value 5 bars ago, red
 * otherwise.
 *
 * Reference: "Fibonacci HH LL Trend Regularity Adaptive Moving Average Band Ribbon" by FibonacciFlux
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RsiFibonacciHhLlSupportResistanceInputs {
  /** Length of the highest / lowest window and of the SMA of the regularity flag */
  length: number;
}

export const defaultInputs: RsiFibonacciHhLlSupportResistanceInputs = {
  length: 55,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 55 },
];

/** Level multiples of the half range: h1..h6 above the midline, l1..l6 below */
const LEVELS = [1.618, 2.618, 3.618, 5.618, 8.618, 13.618];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Midline', color: color.lime, lineWidth: 3 },
  // ph6 .. ph1, then pl6 .. pl1 (Pine plot order)
  ...[6, 5, 4, 3, 2, 1].map((k, j) => ({ id: `plot${1 + j}`, title: `Upper ${k}`, color: color.lime, lineWidth: 1 })),
  ...[6, 5, 4, 3, 2, 1].map((k, j) => ({ id: `plot${7 + j}`, title: `Lower ${k}`, color: color.red, lineWidth: 1 })),
];

export const metadata = {
  title: 'Fibonacci HH LL Trend Regularity Adaptive Moving Average Band Ribbon',
  shortTitle: 'Fibonacci TRAMA Band',
  overlay: true,
};

/** Pine float comparison a > b: a - b > 1e-10; na operands give false */
const gt = (a: number, b: number): boolean => a - b > 1e-10;

export function calculate(bars: Bar[], inputs: Partial<RsiFibonacciHhLlSupportResistanceInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { length } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // hh = math.max(math.sign(ta.change(ta.highest(length))), 0); ll = math.max(math.sign(ta.change(ta.lowest(length)) * -1), 0)
  const highest = A(ta.highest(S(bars.map((b) => b.high)), length));
  const lowest = A(ta.lowest(S(bars.map((b) => b.low)), length));
  const flag = bars.map((_b, i) => {
    const hh = i > 0 ? Math.max(Math.sign(highest[i] - highest[i - 1]), 0) : NaN;
    const ll = i > 0 ? Math.max(Math.sign((lowest[i] - lowest[i - 1]) * -1), 0) : NaN;
    // bool(x): true when x is not na and not 0
    return (!isNaN(hh) && hh !== 0) || (!isNaN(ll) && ll !== 0) ? 1 : 0;
  });
  const regularity = A(ta.sma(S(flag), length));

  const m: number[] = new Array(n);
  const dist: number[] = new Array(n);
  let ama1 = NaN;
  let ama2 = NaN;
  for (let i = 0; i < n; i++) {
    const tc = Math.pow(regularity[i], 2);
    const { high, low } = bars[i];
    // ama := nz(ama[1] + tc * (price - ama[1]), price)
    const a1 = ama1 + tc * (high - ama1);
    const a2 = ama2 + tc * (low - ama2);
    ama1 = isNaN(a1) ? high : a1;
    ama2 = isNaN(a2) ? low : a2;
    m[i] = (ama1 + ama2) / 2;
    dist[i] = (ama1 - ama2) / 2;
  }

  const t = (i: number) => bars[i].time;
  const plots: Record<string, { time: number; value: number; color?: string }[]> = {};
  // plot(m, linewidth = 3, color = m > m[5] ? color.lime : color.red)
  plots.plot0 = m.map((v, i) => ({ time: t(i), value: v, color: i >= 5 && gt(v, m[i - 5]) ? color.lime : color.red }));
  [5, 4, 3, 2, 1, 0].forEach((k, j) => {
    plots[`plot${1 + j}`] = m.map((v, i) => ({ time: t(i), value: v + dist[i] * LEVELS[k], color: color.lime }));
    plots[`plot${7 + j}`] = m.map((v, i) => ({ time: t(i), value: v - dist[i] * LEVELS[k], color: color.red }));
  });

  // fill(ph6, ph5, color.new(color.lime, 70)), fill(pl6, pl5, color.new(color.red, 70)), ... down to ph2 / ph1 (99)
  const transp = [70, 90, 93, 96, 99];
  const fills = transp.flatMap((tr, j) => [
    { plot1: `plot${1 + j}`, plot2: `plot${2 + j}`, options: { title: 'Plots Background', color: String(color.new(color.lime, tr)) } },
    { plot1: `plot${7 + j}`, plot2: `plot${8 + j}`, options: { title: 'Plots Background', color: String(color.new(color.red, tr)) } },
  ]);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
  };
}

export const RsiFibonacciHhLlSupportResistance = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
