/**
 * Fibonacci HH LL TRAMA Band
 *
 * Trend Regularity Adaptive Moving Average (TRAMA) of the high and of the low: the speed tc is the squared SMA of the
 * bars where the highest high or the lowest low of `length` bars made a new extreme; ama = ama[1] + tc * (src - ama[1]).
 * The midline m is the mean of the two averages (lime when above its value 5 bars ago, else red), and the half
 * distance between them is scaled by Fibonacci ratios (0.618, 1.618, 2.618, 4.235, 6.857, 11.089) for six levels
 * above and six below, with fills of decreasing opacity between the levels.
 *
 * Reference: "Fibonacci HH LL TRAMA Band" by FibonacciFlux
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface FibonacciHhLlTramaBandInputs {
  /** Highest / lowest window and SMA length of the TRAMA speed */
  length: number;
}

export const defaultInputs: FibonacciHhLlTramaBandInputs = {
  length: 55,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 55 },
];

const RATIOS = [11.089, 6.857, 4.235, 2.618, 1.618, 0.618];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Midline', color: color.lime, lineWidth: 3 },
  ...RATIOS.map((_r, k) => ({ id: `plot${k + 1}`, title: `H${6 - k}`, color: color.lime, lineWidth: 1 })),
  ...RATIOS.map((_r, k) => ({ id: `plot${k + 7}`, title: `L${6 - k}`, color: color.red, lineWidth: 1 })),
];

export const metadata = {
  title: 'Fibonacci HH LL Trend Regularity Adaptive Moving Average Band Ribbon',
  shortTitle: 'FIB HHLL TRAMA',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(bars: Bar[], inputs: Partial<FibonacciHhLlTramaBandInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { length } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // hh = math.max(math.sign(ta.change(ta.highest(length))), 0); ll = math.max(math.sign(ta.change(ta.lowest(length)) * -1), 0)
  const hiChange = A(ta.change(ta.highest(S(bars.map((b) => b.high)), length)));
  const loChange = A(ta.change(ta.lowest(S(bars.map((b) => b.low)), length)));
  // bool(hh) or bool(ll) ? 1 : 0 (bool(na) and bool(0) are false)
  const newExtreme = bars.map((_b, i) => (Math.max(Math.sign(hiChange[i]), 0) > 0 || Math.max(Math.sign(-loChange[i]), 0) > 0 ? 1 : 0));
  const tcSma = A(ta.sma(S(newExtreme), length));

  const m: number[] = new Array(n);
  const dist: number[] = new Array(n);
  let ama1 = NaN;
  let ama2 = NaN;
  for (let i = 0; i < n; i++) {
    const tc = tcSma[i] ** 2;
    const { high, low } = bars[i];
    // ama := nz(ama[1] + tc * (src - ama[1]), src)
    const a1 = ama1 + tc * (high - ama1);
    const a2 = ama2 + tc * (low - ama2);
    ama1 = Number.isFinite(a1) ? a1 : high;
    ama2 = Number.isFinite(a2) ? a2 : low;
    m[i] = (ama1 + ama2) / 2;
    dist[i] = (ama1 - ama2) / 2;
  }

  const t = (i: number) => bars[i].time;
  const plots: IndicatorResult['plots'] = {
    // plot(m, linewidth = 3, color = m > m[5] ? color.lime : color.red)
    plot0: bars.map((_b, i) => ({ time: t(i), value: m[i], color: i >= 5 && gt(m[i], m[i - 5]) ? color.lime : color.red })),
  };
  RATIOS.forEach((r, k) => {
    plots[`plot${k + 1}`] = bars.map((_b, i) => ({ time: t(i), value: m[i] + dist[i] * r, color: color.lime }));
    plots[`plot${k + 7}`] = bars.map((_b, i) => ({ time: t(i), value: m[i] - dist[i] * r, color: color.red }));
  });

  // fill(ph6, ph5, color.new(color.lime, 70)), fill(pl6, pl5, color.new(color.red, 70)), ... 90, 93, 96, 99
  const transp = [70, 90, 93, 96, 99];
  const fills: NonNullable<IndicatorResult['fills']> = [];
  transp.forEach((tr, k) => {
    fills.push({ plot1: `plot${k + 1}`, plot2: `plot${k + 2}`, options: { color: String(color.new(color.lime, tr)) } });
    fills.push({ plot1: `plot${k + 7}`, plot2: `plot${k + 8}`, options: { color: String(color.new(color.red, tr)) } });
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
  };
}

export const FibonacciHhLlTramaBand = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
