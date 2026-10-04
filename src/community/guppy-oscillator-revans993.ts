/**
 * Guppy Oscillator
 *
 * Difference between the average of the short-term Guppy EMAs (3, 5, 8, 10, 12) and the average of the long-term
 * Guppy EMAs (30, 35, 40, 45, 50) of the close, with an EMA signal line. The histogram is green above zero and red
 * below; it is full colour when it moves away from the signal and half transparent otherwise.
 *
 * Reference: "Guppy Oscillator-REvans993" by REvans993
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface GuppyOscillatorREvans993Inputs {
  /** EMA length of the signal line */
  signalLength: number;
}

export const defaultInputs: GuppyOscillatorREvans993Inputs = {
  signalLength: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: color.green, lineWidth: 3, style: 'histogram' },
  { id: 'plot1', title: 'Signal', color: color.orange, lineWidth: 2 },
];

export const metadata = {
  title: 'Guppy Oscillator',
  shortTitle: 'GMMA Osc',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<GuppyOscillatorREvans993Inputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = Series.fromArray(bars, bars.map((b) => b.close));
  const ema = (len: number) => A(ta.ema(close, len));

  // short_avg = math.avg(ema 3, 5, 8, 10, 12); long_avg = math.avg(ema 30, 35, 40, 45, 50)
  const shortE = [3, 5, 8, 10, 12].map(ema);
  const longE = [30, 35, 40, 45, 50].map(ema);
  const avg = (list: number[][], i: number) => list.reduce((s, a) => s + a[i], 0) / list.length;
  const diff = bars.map((_b, i) => avg(shortE, i) - avg(longE, i));
  const signal = A(ta.ema(Series.fromArray(bars, diff), cfg.signalLength));

  const green = String(color.new(color.green, 0));
  const greenHalf = String(color.new(color.green, 50));
  const red = String(color.new(color.red, 0));
  const redHalf = String(color.new(color.red, 50));
  // hist_color = diff > 0 ? (diff > signal ? green : green 50) : (diff < signal ? red : red 50)
  const histColor = (i: number) => (gt(diff[i], 0)
    ? (gt(diff[i], signal[i]) ? green : greenHalf)
    : (lt(diff[i], signal[i]) ? red : redHalf));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: diff[i], color: histColor(i) })),
      plot1: bars.map((b, i) => ({ time: b.time, value: signal[i], color: color.orange })),
    },
    hlines: [
      { value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dashed' } },
    ],
  };
}

export const GuppyOscillatorREvans993 = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
