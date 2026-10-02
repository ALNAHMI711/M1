/**
 * Price Above EMA15 with RSI & Uptrend (3 Confirmation Bull)
 *
 * A bullish signal (green label below the bar) when three conditions hold: the close is above its EMA, the RSI is
 * above a threshold, and the bar makes a higher high and a higher low: high > highest(high, lookback)[1] and
 * low > lowest(low, lookback)[1]. Plots the close, the EMA and a hidden RSI line; a dotted horizontal line at the
 * RSI threshold.
 *
 * Reference: "3 Confirmation Bull" by AirianM
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AirianM
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface ThreeConfirmationBullInputs {
  /** EMA length */
  emaLength: number;
  /** RSI length */
  rsiLength: number;
  /** RSI threshold: the RSI must be above it */
  rsiThreshold: number;
  /** Lookback of the higher high / higher low test */
  lookback: number;
}

export const defaultInputs: ThreeConfirmationBullInputs = {
  emaLength: 15,
  rsiLength: 14,
  rsiThreshold: 50,
  lookback: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 15, min: 1 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'rsiThreshold', type: 'int', title: 'RSI Threshold', defval: 50, min: 1 },
  { id: 'lookback', type: 'int', title: 'Uptrend Lookback Period', defval: 5, min: 1 },
];

/** Pine default plot colour */
const PINE_BLUE = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: PINE_BLUE, lineWidth: 1 },
  { id: 'plot1', title: 'EMA 15', color: color.blue, lineWidth: 1 },
  { id: 'plot2', title: 'RSI Value', color: color.purple, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Price Above EMA15 with RSI & Uptrend',
  shortTitle: 'Price Above EMA15 with RSI & Uptrend',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<ThreeConfirmationBullInputs> = {},
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
    // isHigherHigh = high > ta.highest(high, lookback)[1]; isHigherLow = low > ta.lowest(low, lookback)[1]
    const prevHh = i > 0 ? hh[i - 1] : NaN;
    const prevLl = i > 0 ? ll[i - 1] : NaN;
    const isUptrend = gt(bars[i].high, prevHh) && gt(bars[i].low, prevLl);
    const signal = gt(bars[i].close, ema[i]) && gt(rsi[i], cfg.rsiThreshold) && isUptrend;
    if (signal) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: color.green, size: 'small' });
    }
  }

  const plot0 = bars.map((b) => ({ time: b.time, value: b.close }));
  const plot1 = bars.map((b, i) => ({ time: b.time, value: ema[i] }));
  const plot2 = bars.map((b, i) => ({ time: b.time, value: rsi[i] }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    hlines: [{ value: cfg.rsiThreshold, options: { title: 'RSI Threshold', color: color.gray, linestyle: 'dotted' } }],
    markers,
  };
}

export const ThreeConfirmationBull = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
