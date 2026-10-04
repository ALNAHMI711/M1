/**
 * Function Savitzky Golay Filter with 7 Vectors
 *
 * A 7-point Savitzky-Golay polynomial of the close:
 * (-2 x[6] + 3 x[5] + 6 x[4] + 7 x[3] + 6 x[2] + 3 x[1] - 2 x[0]) / 21.
 * "regular" uses consecutive bars; "scaling" takes the 7 points `window` bars apart; "duopass" and "tripass" apply
 * the regular filter once / twice more to the scaling result; "multipass" averages the scaling filter of close[i]
 * for i = 0 .. multipass into the close, step by step (x += (filter - x) / 2).
 * In "multipass" the filter is one call site in a loop: its history keeps one value per bar, the argument of the
 * last call of that bar (close[multipass]).
 *
 * Reference: "Function Savitzky Golay with 7 Vectors" by RicardoSantos
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © RicardoSantos.
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface FunctionSavitzkyGolayFilterWith7VectorsV0Inputs {
  /** Distance (bars) between the points of the scaling filter */
  window: number;
  /** Last close offset of the multipass loop (multipass + 1 passes) */
  multipass: number;
}

export const defaultInputs: FunctionSavitzkyGolayFilterWith7VectorsV0Inputs = {
  window: 5,
  multipass: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'window', type: 'int', title: 'window', defval: 5 },
  { id: 'multipass', type: 'int', title: 'multipass', defval: 10 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'regular', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'scaling', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'duopass', color: color.maroon, lineWidth: 1 },
  { id: 'plot3', title: 'tripass', color: color.navy, lineWidth: 1 },
  { id: 'plot4', title: 'multipass', color: color.black, lineWidth: 2 },
];

export const metadata = {
  title: 'Function Savitzky Golay with 7 Vectors',
  shortTitle: 'F',
  overlay: true,
};

/** x[k] of a series kept as an array (na before the first bar) */
const at = (x: number[], i: number, k: number) => (i - k >= 0 ? x[i - k] : NaN);

/** The 7-point polynomial; h(k) = the series k bars back (h(0) = current value) */
const poly = (h: (k: number) => number, w: number) => {
  const a = -2.0 * h(6 * w);
  const b = 3.0 * h(5 * w);
  const c = 6.0 * h(4 * w);
  const d = 7.0 * h(3 * w);
  const e = 6.0 * h(2 * w);
  const f = 3.0 * h(1 * w);
  return (a + b + c + d + e + f - 2.0 * h(0)) / 21.0;
};

export function calculate(
  bars: Bar[],
  inputs: Partial<FunctionSavitzkyGolayFilterWith7VectorsV0Inputs> = {},
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const w = cfg.window;
  const passes = cfg.multipass;
  const close = bars.map((b) => b.close);

  // f_savitzky_golay_filter_w_7_vectors(x) over a whole series
  const regularOf = (x: number[]) => x.map((_v, i) => poly((k) => at(x, i, k), 1));

  const regular = regularOf(close);
  const scaling = close.map((_v, i) => poly((k) => at(close, i, k), w));
  const duopass = regularOf(scaling);
  const tripass = regularOf(regularOf(scaling));

  // multipass: for _i = 0 to passes: r += (f_scaling(close[_i], window) - r) / 2. The in-loop call site keeps the
  // argument of its last call on each earlier bar (close[passes] of that bar) as its history.
  const lastArg: number[] = new Array(n);
  const multipass: number[] = new Array(n);
  // A negative multipass counts down (for i = a to b with a > b) and reads close[-1]: a Pine runtime error
  if (passes < 0) throw new Error('Invalid history offset: multipass must not be negative');
  for (let i = 0; i < n; i++) {
    let r = close[i];
    for (let j = 0; j <= passes; j++) {
      const arg = at(close, i, j);
      const f = poly((k) => (k === 0 ? arg : at(lastArg, i, k)), w);
      r += (f - r) / 2.0;
      lastArg[i] = arg;
    }
    multipass[i] = r;
  }

  const t = (i: number) => bars[i].time;
  const P = (x: number[], c: string) => x.map((v, i) => ({ time: t(i), value: Number.isFinite(v) ? v : NaN, color: c }));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: P(regular, color.blue),
      plot1: P(scaling, color.red),
      plot2: P(duopass, color.maroon),
      plot3: P(tripass, color.navy),
      plot4: P(multipass, color.black),
    },
  };
}

export const FunctionSavitzkyGolayFilterWith7VectorsV0 = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
