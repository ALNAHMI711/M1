/**
 * VOLD Ratio Histogram
 *
 * Log ratio of up volume to down volume. Up volume is the volume of the bars with close > open, down volume the
 * volume of the bars with close < open. Both are summed over `length` bars; the histogram is
 * log((sumUp + epsilon) / (sumDown + epsilon)), green at or above 0, red below.
 *
 * Reference: "VOLD Ratio Histogram V2 - [Th16rry] " by Th16rry
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Th16rry
 */

import { math, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VoldRatioHistogramInputs {
  /** Sum length */
  length: number;
  /** Added to both sums against a division by zero */
  epsilon: number;
}

export const defaultInputs: VoldRatioHistogramInputs = {
  length: 30,
  epsilon: 1.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Période de calcul (somme)', defval: 30, min: 1 },
  { id: 'epsilon', type: 'float', title: 'Epsilon anti-division par zéro', defval: 1.0, min: 0.000001 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VOLD Log Ratio Histogram', color: color.green, lineWidth: 2, style: 'histogram' },
];

export const metadata = {
  title: 'VOLD Ratio Histogram V2 - [Th16rry] ',
  shortTitle: 'VOLD Ratio Histogram V2 - [Th16rry] ',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(bars: Bar[], inputs: Partial<VoldRatioHistogramInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // upVolume = close > open ? volume : 0.0; downVolume = close < open ? volume : 0.0
  const upVolume = bars.map((b) => (gt(b.close, b.open) ? (b.volume ?? NaN) : 0));
  const downVolume = bars.map((b) => (gt(b.open, b.close) ? (b.volume ?? NaN) : 0));
  const sumUp = A(math.sum(S(upVolume), cfg.length) as Series);
  const sumDown = A(math.sum(S(downVolume), cfg.length) as Series);

  const plot0 = bars.map((b, i) => {
    const v = Math.log((sumUp[i] + cfg.epsilon) / (sumDown[i] + cfg.epsilon));
    return { time: b.time, value: Number.isFinite(v) ? v : NaN, color: ge(v, 0) ? color.green : color.red };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    hlines: [{ value: 0, options: { title: 'Équilibre', color: color.gray, linestyle: 'dashed' } }],
  };
}

export const VoldRatioHistogram = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
