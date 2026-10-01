/**
 * Median MACD
 *
 * A MACD of the rolling median of the close: median = percentile_nearest_rank(close, period, 50),
 * MACD = ema(median, fast) - ema(median, slow), signal = ema(MACD, MACD length). The columns are MACD - signal,
 * light blue above zero and rising, teal above zero and falling, purple below zero and falling, dark purple below
 * zero and rising (the colour is kept when the delta does not change).
 *
 * Reference: "Median MACD - Mattes" by Mattes00
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Mattes00
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface MedianMacdMattesInputs {
  fastLength: number;
  slowlength: number;
  /** EMA length of the signal line */
  MACDLength: number;
  /** Median period */
  MedLookBack: number;
}

export const defaultInputs: MedianMacdMattesInputs = {
  fastLength: 6,
  slowlength: 36,
  MACDLength: 21,
  MedLookBack: 11,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 6, min: 1, step: 1, group: 'Median MACD' },
  { id: 'slowlength', type: 'int', title: 'Slow Length', defval: 36, min: 1, step: 1, group: 'Median MACD' },
  { id: 'MACDLength', type: 'int', title: 'MACD Length', defval: 21, min: 1, step: 1, group: 'Median MACD' },
  { id: 'MedLookBack', type: 'int', title: 'Median Period', defval: 11, min: 1, step: 1, group: 'Median MACD' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Delta', color: '#4caf50', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Median MACD - Mattes',
  shortTitle: 'Median MACD',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<MedianMacdMattesInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const median = ta.percentile_nearest_rank(S(bars.map((b) => b.close)), cfg.MedLookBack, 50);
  const fast = A(ta.ema(median, cfg.fastLength));
  const slow = A(ta.ema(median, cfg.slowlength));
  const macd = fast.map((f, i) => f - slow[i]);
  const aMacd = A(ta.ema(S(macd), cfg.MACDLength));
  const delta = macd.map((m, i) => m - aMacd[i]);

  // var color col = #4caf50, changed by the four conditions in order
  let col = '#4caf50';
  const plot0 = [];
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? delta[i - 1] : NaN;
    const posroc = gt(delta[i], prev);
    const negroc = lt(delta[i], prev);
    if (gt(delta[i], 0) && posroc) col = '#57a9ed';
    if (gt(delta[i], 0) && negroc) col = '#0a8090';
    if (lt(delta[i], 0) && negroc) col = '#a354b1';
    if (lt(delta[i], 0) && posroc) col = '#67356f';
    plot0.push({ time: bars[i].time, value: delta[i], color: col });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const MedianMacdMattes = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
