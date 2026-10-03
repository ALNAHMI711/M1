/**
 * COV Bands ~ C H I P A
 *
 * Bands from the coefficient of variation of the close: mean = sma(close, length),
 * cov = stdev(close, stddev) / mean; upper = mean + mean * cov * upperMulti, lower = mean - mean * cov * lowerMulti.
 * A close above the upper band sets the trend to long (blue candles), a close below the lower band sets it to short
 * (red candles); the trend stays until the other band is crossed. Candles are drawn in the indicator pane on the
 * last 10,000 bars.
 *
 * Reference: "COV Bands ~ C H I P A" by C_H_I_P_A
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © C_H_I_P_A
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface CovBandsInputs {
  /** SMA length of the mean */
  length: number;
  upperBandMulti: number;
  lowerBandMulti: number;
  /** Standard deviation length */
  stddev: number;
}

export const defaultInputs: CovBandsInputs = {
  length: 46,
  upperBandMulti: 1.2,
  lowerBandMulti: 0.3,
  stddev: 31,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Period Length', defval: 46, group: 'Indicator Inputs' },
  { id: 'upperBandMulti', type: 'float', title: 'Upper Band Multiplier', defval: 1.2, step: 0.02, group: 'Indicator Inputs' },
  { id: 'lowerBandMulti', type: 'float', title: 'Lower Band Multiplier', defval: 0.3, step: 0.02, group: 'Indicator Inputs' },
  { id: 'stddev', type: 'int', title: 'Standard Deviation', defval: 31, group: 'Indicator Inputs' },
];

const GRAY = String(color.rgb(150, 150, 160));
const GRAY_FADE = String(color.new(color.rgb(150, 150, 160), 70));
const LONG_COL = String(color.rgb(0, 180, 255));
const SHORT_COL = String(color.rgb(255, 80, 60));
/** plotcandle show_last */
const SHOW_LAST = 10000;

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: GRAY, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: GRAY, lineWidth: 1 },
];

export const metadata = {
  title: 'COV Bands ~ C H I P A',
  shortTitle: 'COV Bands ~ C H I P A',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<CovBandsInputs> = {},
): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = Series.fromArray(bars, bars.map((b) => b.close));

  const mean = A(ta.sma(close, cfg.length));
  const stdDev = A(ta.stdev(close, cfg.stddev));

  const upper: number[] = new Array(n);
  const lower: number[] = new Array(n);
  const candles: PlotCandleData[] = [];
  let cb = 0; // var cb = 0
  let coloring = 'transparent'; // var color coloring = na
  for (let i = 0; i < n; i++) {
    // A plain division: x / 0 is +-infinity (0 / 0 NaN), as in Pine
    const cov = stdDev[i] / mean[i];
    upper[i] = mean[i] + mean[i] * cov * cfg.upperBandMulti;
    lower[i] = mean[i] - mean[i] * cov * cfg.lowerBandMulti;
    const c = bars[i].close;
    if (gt(c, upper[i])) cb = 1;
    if (gt(lower[i], c)) cb = -1;
    if (cb === 1) coloring = LONG_COL;
    else if (cb === -1) coloring = SHORT_COL;
    // plotcandle(open, high, low, close, 'Candle Coloring', coloring, coloring, true, show_last = 10000, coloring)
    if (i >= n - SHOW_LAST) {
      const b = bars[i];
      candles.push({
        time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
        color: coloring, wickColor: coloring, borderColor: coloring,
      });
    }
  }

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: fin(upper[i]), color: GRAY })),
      plot1: bars.map((b, i) => ({ time: b.time, value: fin(lower[i]), color: GRAY })),
    },
    // fill(upper_plot, lower_plot, grayfade)
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: GRAY_FADE } }],
    plotCandles: { candleColoring: candles },
  };
}

export const CovBands = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
