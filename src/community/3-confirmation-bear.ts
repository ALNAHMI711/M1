/**
 * Price Below EMA15 with RSI & Downtrend (3 Confirmation Bear)
 *
 * A bearish signal (red label above the bar) when three conditions hold: the close is below its EMA, the RSI is
 * below a threshold, and the bar makes a lower high and a lower low: high < highest(high, lookback)[1] and
 * low < lowest(low, lookback)[1]. Plots the EMA and a hidden RSI line; a dotted horizontal line at the RSI threshold.
 *
 * Reference: "3 Confirmation Bear" by AirianM
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AirianM
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface ThreeConfirmationBearInputs {
  /** EMA length */
  emaLength: number;
  /** RSI length */
  rsiLength: number;
  /** RSI threshold: the RSI must be below it */
  rsiThreshold: number;
  /** Lookback of the lower high / lower low test */
  lookback: number;
}

export const defaultInputs: ThreeConfirmationBearInputs = {
  emaLength: 15,
  rsiLength: 14,
  rsiThreshold: 50,
  lookback: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 15, min: 1 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'rsiThreshold', type: 'int', title: 'RSI Threshold', defval: 50, min: 1 },
  { id: 'lookback', type: 'int', title: 'Downtrend Lookback Period', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 15', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'RSI Value', color: color.purple, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Price Below EMA15 with RSI & Downtrend',
  shortTitle: 'Price Below EMA15 with RSI & Downtrend',
  overlay: true,
};

/** Pine float comparisons: a < b only when b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<ThreeConfirmationBearInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const close = S(bars.map((b) => b.close));

  const ema = A(ta.ema(close, cfg.emaLength));
  const rsi = A(ta.rsi(close, cfg.rsiLength));
  const hh = A(ta.highest(S(bars.map((b) => b.high)), cfg.lookback));
  const ll = A(ta.lowest(S(bars.map((b) => b.low)), cfg.lookback));

  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    // isLowerHigh = high < ta.highest(high, lookback)[1]; isLowerLow = low < ta.lowest(low, lookback)[1]
    const prevHh = i > 0 ? hh[i - 1] : NaN;
    const prevLl = i > 0 ? ll[i - 1] : NaN;
    const isDowntrend = lt(bars[i].high, prevHh) && lt(bars[i].low, prevLl);
    const signal = lt(bars[i].close, ema[i]) && lt(rsi[i], cfg.rsiThreshold) && isDowntrend;
    if (signal) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: color.red, size: 'small' });
    }
  }

  const plot0 = bars.map((b, i) => ({ time: b.time, value: ema[i] }));
  const plot1 = bars.map((b, i) => ({ time: b.time, value: rsi[i] }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    hlines: [{ value: cfg.rsiThreshold, options: { title: 'RSI Threshold', color: color.gray, linestyle: 'dotted' } }],
    markers,
  };
}

export const ThreeConfirmationBear = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
