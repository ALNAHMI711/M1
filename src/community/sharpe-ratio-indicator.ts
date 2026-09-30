/**
 * Sharpe Ratio Indicator (180)
 *
 * Sharpe ratio of the bar returns over `lookback` bars: r = (close - close[1]) / close[1];
 * sharpe = (sma(r, lookback) * 365 - riskFreeRate) / (stdev(r, lookback) * sqrt(lookback)). The line is red above
 * the overvalued level, green between the undervalued and the critically undervalued levels, blue below the
 * critically undervalued level and yellow otherwise. Horizontal lines at the three levels and at 0.
 *
 * Reference: "Sharpe Ratio Indicator (180)" by tim_amblard
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface SharpeRatioIndicatorInputs {
  /** Risk-free rate (annualized, in decimal) */
  riskFreeRate: number;
  /** Lookback period in bars */
  lookback: number;
  overValued: number;
  underValued: number;
  criticallyUnderValued: number;
}

export const defaultInputs: SharpeRatioIndicatorInputs = {
  riskFreeRate: 0.04,
  lookback: 180,
  overValued: 5.0,
  underValued: -1.0,
  criticallyUnderValued: -3.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'riskFreeRate', type: 'float', title: 'Risk-Free Rate (annualized, in decimal)', defval: 0.04, min: 0.0 },
  { id: 'lookback', type: 'int', title: 'Lookback Period (180 Days)', defval: 180, min: 1 },
  { id: 'overValued', type: 'float', title: 'OverValued', defval: 5.0 },
  { id: 'underValued', type: 'float', title: 'UnderValued', defval: -1.0 },
  { id: 'criticallyUnderValued', type: 'float', title: 'CriticallyUnderValued', defval: -3.0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Sharpe Ratio (180)', color: color.yellow, lineWidth: 2 },
];

export const metadata = {
  title: 'Sharpe Ratio Indicator (180)',
  shortTitle: 'Sharpe Ratio (180)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(bars: Bar[], inputs: Partial<SharpeRatioIndicatorInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { riskFreeRate, lookback, overValued, underValued, criticallyUnderValued } = cfg;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // dailyReturn = (close - close[1]) / close[1]
  const ret = bars.map((b, i) => (i > 0 ? (b.close - bars[i - 1].close) / bars[i - 1].close : NaN));
  const retSeries = Series.fromArray(bars, ret);
  const mean = A(ta.sma(retSeries, lookback));
  const sd = A(ta.stdev(retSeries, lookback));

  const plot0 = bars.map((b, i) => {
    const stdDev = sd[i] * Math.sqrt(lookback);
    // x / 0 is na in Pine
    const sharpe = stdDev !== 0 ? (mean[i] * 365 - riskFreeRate) / stdDev : NaN;
    const isOver = gt(sharpe, overValued);
    const isUnder = gt(underValued, sharpe) && gt(sharpe, criticallyUnderValued);
    const isCritical = gt(criticallyUnderValued, sharpe);
    const c = isOver ? color.red : isUnder ? color.green : isCritical ? color.blue : color.yellow;
    return { time: b.time, value: sharpe, color: c };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    hlines: [
      { value: overValued, options: { title: 'Overvalued Zone', color: color.red, linestyle: 'dashed' } },
      { value: underValued, options: { title: 'Undervalued Zone', color: color.green, linestyle: 'dashed' } },
      { value: criticallyUnderValued, options: { title: 'Critically Undervalued Zone', color: color.blue, linestyle: 'dashed' } },
      { value: 0, options: { title: 'Neutral Zone', color: color.gray, linestyle: 'dotted' } },
    ],
  };
}

export const SharpeRatioIndicator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
