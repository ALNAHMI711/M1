/**
 * SCE GANN Predictions
 *
 * Velocity V = average of (close - open) over the last n bars. GANN(Gr) = close[n] + Gr * 2n * V. On each bar the
 * ratio Gr runs from the minimum to the maximum by the step; each ratio gets the sum of squared errors between the
 * last n closes and SMA(GANN(Gr), n), and the ratio with the lowest error seen so far on the whole history is kept.
 * The plot is SMA(GANN(kept ratio), n): teal when the close is above it, red when below.
 *
 * Reference: "SCE GANN Predictions" by ScorsoneEnterprises
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ScorsoneEnterprises
 */

import { ta, Series, color, array, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface SceGannPredictionsInputs {
  /** Pine input "Select the TimeFrame to analyze": the script never reads it, so it changes nothing */
  tfInput: string;
  showGann: boolean;
  /** Lookback period n of the GANN wave */
  Gn: number;
  GrMin: number;
  GrMax: number;
  GrStep: number;
}

export const defaultInputs: SceGannPredictionsInputs = {
  tfInput: '2',
  showGann: true,
  Gn: 15,
  GrMin: 0.05,
  GrMax: 0.2,
  GrStep: 0.01,
};

export const inputConfig: InputConfig[] = [
  { id: 'tfInput', type: 'timeframe', title: 'Select the TimeFrame to analyze', defval: '2', group: 'timeframe' },
  { id: 'showGann', type: 'bool', title: 'Show the GANN Wave?', defval: true, group: 'plotting' },
  { id: 'Gn', type: 'int', title: 'Select a lookback period for the GANN Wave', defval: 15, group: 'plotting' },
  { id: 'GrMin', type: 'float', title: 'Min ratio for the GANN Wave', defval: 0.05, group: 'optimization' },
  { id: 'GrMax', type: 'float', title: 'Max ratio for the GANN Wave', defval: 0.2, group: 'optimization' },
  { id: 'GrStep', type: 'float', title: 'Step for the GANN Wave ratio', defval: 0.01, group: 'optimization' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'GANN', color: color.teal, lineWidth: 2 },
];

export const metadata = {
  title: 'SCE GANN Predictions',
  shortTitle: 'SCE GANN Predictions',
  overlay: true,
};

/** Pine float comparisons: 1e-10 tolerance, na compares false */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<SceGannPredictionsInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { Gn: n, GrMin, GrMax, GrStep } = cfg;
  const len = bars.length;
  const close = (t: number) => (t >= 0 ? bars[t].close : NaN);

  // V(n): array.sum of close[i] - open[i], i = 0 .. n - 1, divided by n
  const velocity = (t: number): number => {
    const prices: number[] = new Array(n);
    for (let i = 0; i <= n - 1; i++) prices[i] = t - i >= 0 ? bars[t - i].close - bars[t - i].open : NaN;
    return array.sum(prices) / n;
  };
  // G(n, Gr) = close[n] + Gr * delta_days * V(n), delta_days = (n + n * 2) - n
  const deltaDays = n + n * 2 - n;
  const gann = (t: number, gr: number, v: number) => close(t - n) + gr * deltaDays * v;

  // ta.sma(GANN, n) inside evaluateGr: one call site called once per ratio in the while loop. Its history keeps
  // one value per bar (the value of its last call in that bar); ta.sma skips na values.
  const loopHist: number[] = []; // non-na GANN values of the last call of the previous bars
  let loopPrev = NaN; // result of the last call of the previous bar
  const loopSma = (x: number): number => {
    if (isNaN(x)) return loopPrev;
    const h = loopHist.length;
    if (h < n - 1) return NaN;
    let s = 0;
    for (let k = h - (n - 1); k < h; k++) s += loopHist[k];
    return (s + x) / n;
  };

  let optimalGr = NaN; // var float optimalGr = na
  let minSSE = NaN; // var float minSSE = na
  const GANN: number[] = new Array(len);
  for (let t = 0; t < len; t++) {
    const v = velocity(t);
    let lastX = NaN;
    let lastSma = NaN;
    let called = false;
    let i = GrMin;
    while (lt(i, GrMax)) {
      // evaluateGr(Gn, i)
      const x = gann(t, i, v);
      const epSma = loopSma(x);
      let sse = 0.0;
      for (let j = 0; j <= n - 1; j++) sse = sse + Math.pow(close(t - j) - epSma, 2);
      if (isNaN(minSSE) || lt(sse, minSSE)) {
        minSSE = sse;
        optimalGr = i;
      }
      lastX = x;
      lastSma = epSma;
      called = true;
      i = i + GrStep;
      if (!(GrStep > 0) && lt(i, GrMax)) throw new Error('Loop takes too long to execute: Gr_step must be greater than 0');
    }
    if (called) {
      if (!isNaN(lastX)) loopHist.push(lastX);
      loopPrev = lastSma;
    }
    GANN[t] = gann(t, optimalGr, v);
  }

  // ep_sma = showGann ? ta.sma(GANN, Gn) : na (the ta.sma only runs when showGann is true)
  const epSma = cfg.showGann
    ? ta.sma(Series.fromArray(bars, GANN), n).toArray().map((x) => x ?? NaN)
    : new Array<number>(len).fill(NaN);

  const plot0 = bars.map((b, t) => {
    const e = epSma[t];
    // if close > ep_sma: teal; else if close < ep_sma: red; else na
    const c = gt(b.close, e) ? color.teal : lt(b.close, e) ? color.red : undefined;
    const value = Number.isFinite(e) ? e : NaN;
    return c === undefined ? { time: b.time, value } : { time: b.time, value, color: c };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const SceGannPredictions = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
