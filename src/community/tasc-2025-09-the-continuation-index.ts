/**
 * TASC 2025.09 The Continuation Index (John F. Ehlers)
 *
 * us = UltimateSmoother(source, int(length / 2)); lg = an N-order Laguerre filter whose first term is
 * UltimateSmoother(source, length) (the mean of the `order` terms). ref = nz(2 * (us - lg) / sma(|us - lg|, length));
 * the index is the inverse Fisher transform (e^(2 ref) - 1) / (e^(2 ref) + 1). Above 0.5 the line and the bars go
 * from gray to the uptrend colour, below -0.5 they take the downtrend colour, gray otherwise.
 *
 * Reference: "TASC 2025.09 The Continuation Index" by PineCodersTASC
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, Series, color, getSourceSeries,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface Tasc202509TheContinuationIndexInputs {
  /** Source */
  source: SourceType;
  /** Phase response of the Laguerre terms (0..1) */
  gamma: number;
  /** Order of the Laguerre filter (1..10) */
  order: number;
  /** Calculation length */
  length: number;
  /** Uptrend colour */
  upColor: string;
  /** Downtrend colour */
  downColor: string;
}

export const defaultInputs: Tasc202509TheContinuationIndexInputs = {
  source: 'close',
  gamma: 0.8,
  order: 8,
  length: 40,
  upColor: color.green,
  downColor: color.red,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source:', defval: 'close' },
  { id: 'gamma', type: 'float', title: 'Gamma:', defval: 0.8, min: 0.0, max: 1.0, step: 0.05 },
  { id: 'order', type: 'int', title: 'Order:', defval: 8, min: 1, max: 10 },
  { id: 'length', type: 'int', title: 'Length:', defval: 40, min: 3 },
  { id: 'upColor', type: 'color', title: 'Uptrend color:', defval: color.green },
  { id: 'downColor', type: 'color', title: 'Downtrend color:', defval: color.red },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Continuation Index', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'TASC 2025.09 The Continuation Index',
  shortTitle: 'CI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const nz = (x: number) => (Number.isFinite(x) ? x : 0);

/** UltimateSmoother of the TASC 2024.04 article: the source itself on the first 4 bars */
function ultimateSmoother(src: number[], period: number): number[] {
  const a1 = Math.exp((-1.414 * Math.PI) / period);
  const c2 = 2.0 * a1 * Math.cos((1.414 * Math.PI) / period);
  const c3 = -a1 * a1;
  const c1 = (1.0 + c2 - c3) / 4.0;
  const us: number[] = new Array(src.length);
  for (let i = 0; i < src.length; i++) {
    us[i] = src[i];
    if (i >= 4) {
      us[i] = (1.0 - c1) * src[i] + (2.0 * c1 - c2) * src[i - 1] - (c1 + c3) * src[i - 2]
        + c2 * nz(us[i - 1]) + c3 * nz(us[i - 2]);
    }
  }
  return us;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<Tasc202509TheContinuationIndexInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { gamma, order, length } = cfg;
  const n = bars.length;
  const src = getSourceSeries(bars, cfg.source).toArray().map((v) => v ?? NaN);

  // us = ultimateSmoother(src, int(length / 2))
  const us = ultimateSmoother(src, Math.trunc(length / 2));
  // laguerreFilter(src, gamma, order, length): var matrix lg (order x 2, 0.0); column 0 = current, 1 = previous
  const first = ultimateSmoother(src, length);
  const cur: number[] = new Array(order).fill(0.0);
  const prev: number[] = new Array(order).fill(0.0);
  const lg: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    prev[0] = cur[0];
    cur[0] = first[i];
    let fir = cur[0];
    for (let k = 1; k < order; k++) {
      prev[k] = cur[k];
      cur[k] = gamma * (prev[k] - prev[k - 1]) + prev[k - 1];
      fir += cur[k];
    }
    lg[i] = fir / order;
  }
  const diff = bars.map((_b, i) => us[i] - lg[i]);
  const avgAbs = ta.sma(Series.fromArray(bars, diff.map((d) => Math.abs(d))), length).toArray().map((v) => v ?? NaN);

  const gray = color.gray;
  const plot0: { time: number; value: number; color: string }[] = [];
  const barColors: BarColorData[] = [];
  for (let i = 0; i < n; i++) {
    // A plain division: x / 0 is +-infinity (0 / 0 NaN); nz() makes both 0
    const ref = nz((2.0 * diff[i]) / avgAbs[i]);
    const ci = (Math.exp(2.0 * ref) - 1.0) / (Math.exp(2.0 * ref) + 1.0);
    const c = gt(ci, 0.5)
      ? color.from_gradient(ci, 0.5, 1.0, gray, cfg.upColor)
      : lt(ci, -0.5)
        ? color.from_gradient(ci, -0.5, -1.0, cfg.downColor, gray)
        : gray;
    plot0.push({ time: bars[i].time, value: Number.isFinite(ci) ? ci : NaN, color: c });
    barColors.push({ time: bars[i].time, color: c });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    barColors,
  };
}

export const Tasc202509TheContinuationIndex = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
