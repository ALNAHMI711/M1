/**
 * Z-Score Trend Monitor
 *
 * The spread between a weighted short SMA and a weighted long SMA of the close
 * (spread = sma(close, short) * shortWeight - sma(close, long) * longWeight), turned into a z-score over a lookback
 * window: z = (spread - sma(spread, lookback)) / stdev(spread, lookback). Horizontal lines at +threshold,
 * -threshold and 0.
 *
 * Reference: "Z-Score Trend Monitor [EdgeTerminal]" by EdgeTerminal
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © EdgeTerminal
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ZScoreTrendMonitorInputs {
  /** Short SMA length */
  lenShort: number;
  /** Short term weight */
  weiShort: number;
  /** Long SMA length */
  lenLong: number;
  /** Long term weight */
  weiLong: number;
  /** Z-score threshold (horizontal lines at +threshold / -threshold) */
  zThreshold: number;
  /** Z-score lookback window */
  lookback: number;
}

export const defaultInputs: ZScoreTrendMonitorInputs = {
  lenShort: 14,
  weiShort: 1,
  lenLong: 60,
  weiLong: 1,
  zThreshold: 2.0,
  lookback: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'lenShort', type: 'int', title: 'Short SMA', defval: 14 },
  { id: 'weiShort', type: 'float', title: 'Short Term Weight', defval: 1, max: 1, step: 0.01 },
  { id: 'lenLong', type: 'int', title: 'Long SMA', defval: 60 },
  { id: 'weiLong', type: 'float', title: 'Long Term Weight', defval: 1, max: 1, step: 0.01 },
  { id: 'zThreshold', type: 'float', title: 'Z-Score Threshold', defval: 2.0, step: 0.1 },
  { id: 'lookback', type: 'int', title: 'Z-Score Lookback Window', defval: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Z-Score', color: color.blue, lineWidth: 2 },
];

export const metadata = {
  title: 'Z-Score Trend Monitor [EdgeTerminal]',
  shortTitle: 'Z-Score Trend Monitor [EdgeTerminal]',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ZScoreTrendMonitorInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const close = S(bars.map((b) => b.close));
  const smaShort = A(ta.sma(close, cfg.lenShort)).map((v) => v * cfg.weiShort);
  const smaLong = A(ta.sma(close, cfg.lenLong)).map((v) => v * cfg.weiLong);
  const spread = smaShort.map((v, i) => v - smaLong[i]);
  const spreadMean = A(ta.sma(S(spread), cfg.lookback));
  const spreadStd = A(ta.stdev(S(spread), cfg.lookback));

  const plot0 = bars.map((b, i) => {
    // A plain division: x / 0 is +-infinity (the plot shows na), 0 / 0 is na
    const z = (spread[i] - spreadMean[i]) / spreadStd[i];
    return { time: b.time, value: Number.isFinite(z) ? z : NaN, color: color.blue };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    hlines: [
      { value: cfg.zThreshold, options: { title: 'Upper Threshold', color: color.red, linestyle: 'dashed' } },
      { value: -cfg.zThreshold, options: { title: 'Lower Threshold', color: color.green, linestyle: 'dashed' } },
      { value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dashed' } },
    ],
  };
}

export const ZScoreTrendMonitor = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
