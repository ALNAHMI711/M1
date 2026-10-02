/**
 * Relative ATR Volatility
 *
 * The ATR is compared with its own distribution over a rolling window: the bottom, top and 50 % percentiles
 * (nearest rank) of the ATR over the window are the thresholds. Where the ATR is at or above the top threshold, the
 * area between the ATR and the top threshold is filled red; at or below the bottom threshold, the area between the
 * ATR and the bottom threshold is filled green. The fill is more opaque the further the ATR is from the threshold
 * (relative distance, capped at 100 %). The ratios of the ATR to each threshold are shown in the status line.
 *
 * Reference: "Relative ATR Volatility" by ZenAndTheArtOfTrading
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ZenAndTheArtOfTrading
 */

import { taCore, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RelativeAtrVolatilityInputs {
  atrLength: number;
  /** Rolling window of the percentiles */
  windowLength: number;
  /** Top percentile */
  topPercent: number;
  /** Bottom percentile */
  bottomPercent: number;
}

export const defaultInputs: RelativeAtrVolatilityInputs = {
  atrLength: 14,
  windowLength: 100,
  topPercent: 80,
  bottomPercent: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'windowLength', type: 'int', title: 'Rolling Window Length', defval: 100 },
  { id: 'topPercent', type: 'float', title: 'Top Percentile', defval: 80 },
  { id: 'bottomPercent', type: 'float', title: 'Bottom Percentile', defval: 20 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR', color: color.white, lineWidth: 1 },
  { id: 'plot1', title: 'Bottom X% Threshold', color: color.green, lineWidth: 1, display: 'pane' },
  { id: 'plot2', title: 'Top X% Threshold', color: color.red, lineWidth: 1, display: 'pane' },
  { id: 'plot3', title: 'Median ATR', color: color.gray, lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Top ATR Fill', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Bottom ATR Fill', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'ATR Ratio (vs Upper Band)', color: color.red, lineWidth: 1, display: 'status_line' },
  { id: 'plot7', title: 'ATR Ratio (vs Lower Band)', color: color.green, lineWidth: 1, display: 'status_line' },
];

export const metadata = {
  title: 'Relative ATR Volatility',
  shortTitle: 'Relative ATR Volatility',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a >= b when b - a <= 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

export function calculate(bars: Bar[], inputs: Partial<RelativeAtrVolatilityInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const close = bars.map((b) => b.close);

  const atr = taCore.atr(cfg.atrLength, high, low, close);
  const bottom = taCore.percentile_nearest_rank(atr, cfg.windowLength, cfg.bottomPercent);
  const top = taCore.percentile_nearest_rank(atr, cfg.windowLength, cfg.topPercent);
  const center = taCore.percentile_nearest_rank(atr, cfg.windowLength, 50);

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const P = (f: (i: number) => number, c?: string) =>
    bars.map((b, i) => (c === undefined ? { time: b.time, value: fin(f(i)) } : { time: b.time, value: fin(f(i)), color: c }));

  const isTop = (i: number) => ge(atr[i], top[i]);
  const isBottom = (i: number) => le(atr[i], bottom[i]);
  const topColors: string[] = new Array(n);
  const bottomColors: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let topGradient = 0;
    let bottomGradient = 0;
    if (isTop(i) && gt(top[i], 0)) topGradient = (atr[i] - top[i]) / top[i];
    if (isBottom(i) && gt(bottom[i], 0)) bottomGradient = (bottom[i] - atr[i]) / bottom[i];
    topGradient = Math.min(topGradient, 1.0);
    bottomGradient = Math.min(bottomGradient, 1.0);
    // 90 - int(gradient * 80)
    topColors[i] = String(color.new(color.red, 90 - Math.trunc(topGradient * 80)));
    bottomColors[i] = String(color.new(color.green, 90 - Math.trunc(bottomGradient * 80)));
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: P((i) => atr[i], color.white),
      plot1: P((i) => bottom[i], color.green),
      plot2: P((i) => top[i], color.red),
      plot3: P((i) => center[i], color.gray),
      // isTopX ? atrValue : na / isBottomX ? atrValue : na
      plot4: P((i) => (isTop(i) ? atr[i] : NaN)),
      plot5: P((i) => (isBottom(i) ? atr[i] : NaN)),
      // a plain division (x / 0 is +-infinity, shown as na)
      plot6: P((i) => atr[i] / top[i], color.red),
      plot7: P((i) => atr[i] / bottom[i], color.green),
    },
    fills: [
      // fill(topAtrFillPlot, topPlot, color.new(color.red, topTransparency))
      { plot1: 'plot4', plot2: 'plot2', colors: topColors },
      // fill(bottomAtrFillPlot, bottomPlot, color.new(color.green, bottomTransparency))
      { plot1: 'plot5', plot2: 'plot1', colors: bottomColors },
    ],
  };
}

export const RelativeAtrVolatility = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
