/**
 * ADX Trend Visualizer with Dual Thresholds
 *
 * Hand-made ADX: +DM / -DM from the high / low changes, +DI and -DI as 100 * RMA(DM) / RMA(true range),
 * DX = 100 * |+DI - -DI| / (+DI + -DI) and ADX = RMA(DX). The ADX line is green above the strong trend threshold,
 * red below the weak trend threshold and yellow between them. +DI and -DI are hidden plots.
 *
 * Reference: "ADX Trend Visualizer with Dual Thresholds" by crankyprofits
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AdxTrendVisualizerWithDualThresholdsInputs {
  /** ADX smoothing length */
  adxLength: number;
  /** Below this ADX the trend is weak */
  lowerThreshold: number;
  /** Above this ADX the trend is strong */
  upperThreshold: number;
}

export const defaultInputs: AdxTrendVisualizerWithDualThresholdsInputs = {
  adxLength: 14,
  lowerThreshold: 15,
  upperThreshold: 25,
};

export const inputConfig: InputConfig[] = [
  { id: 'adxLength', type: 'int', title: 'ADX Length', defval: 14 },
  { id: 'lowerThreshold', type: 'int', title: 'Weak Trend Threshold', defval: 15 },
  { id: 'upperThreshold', type: 'int', title: 'Strong Trend Threshold', defval: 25 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADX', color: color.yellow, lineWidth: 2 },
  { id: 'plot1', title: '+DI', color: color.teal, lineWidth: 1, display: 'none' },
  { id: 'plot2', title: '-DI', color: color.orange, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'ADX Trend Visualizer with Dual Thresholds',
  shortTitle: 'ADX Trend Visualizer with Dual Thresholds',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Plots show na for non-finite values */
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

export function calculate(
  bars: Bar[],
  inputs: Partial<AdxTrendVisualizerWithDualThresholdsInputs> = {},
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const len = cfg.adxLength;

  // up = math.max(ta.change(high), 0), down = math.max(-ta.change(low), 0) (na on bar 0)
  const up = bars.map((b, i) => (i > 0 ? Math.max(b.high - bars[i - 1].high, 0) : NaN));
  const down = bars.map((b, i) => (i > 0 ? Math.max(-(b.low - bars[i - 1].low), 0) : NaN));
  const plusDM = up.map((u, i) => (gt(u, down[i]) && gt(u, 0) ? u : 0));
  const minusDM = down.map((d, i) => (gt(d, up[i]) && gt(d, 0) ? d : 0));
  const trur = A(ta.rma(ta.tr(bars, true), len));
  const plusRma = A(ta.rma(S(plusDM), len));
  const minusRma = A(ta.rma(S(minusDM), len));
  // Plain divisions: x / 0 is +-infinity, 0 / 0 is na (ta.rma skips both)
  const plusDI = plusRma.map((v, i) => (100 * v) / trur[i]);
  const minusDI = minusRma.map((v, i) => (100 * v) / trur[i]);
  const dx = plusDI.map((p, i) => (100 * Math.abs(p - minusDI[i])) / (p + minusDI[i]));
  const adx = A(ta.rma(S(dx), len));

  const plot0 = bars.map((b, i) => {
    const c = gt(adx[i], cfg.upperThreshold) ? color.green : lt(adx[i], cfg.lowerThreshold) ? color.red : color.yellow;
    return { time: b.time, value: fin(adx[i]), color: c };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0,
      plot1: bars.map((b, i) => ({ time: b.time, value: fin(plusDI[i]), color: color.teal })),
      plot2: bars.map((b, i) => ({ time: b.time, value: fin(minusDI[i]), color: color.orange })),
    },
    hlines: [
      { value: cfg.lowerThreshold, options: { title: 'Lower Threshold', color: color.red, linestyle: 'dotted' } },
      { value: cfg.upperThreshold, options: { title: 'Upper Threshold', color: color.green, linestyle: 'dotted' } },
    ],
  };
}

export const AdxTrendVisualizerWithDualThresholds = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
