/**
 * Renko Sniper PRO (Liquidity Sweep + EMA + ST + RSI)
 *
 * A fast and a slow EMA of the close and a Supertrend line (green when the Supertrend direction is 1, red
 * otherwise). A liquidity sweep is marked when the bar goes past the highest high (lowest low) of the last
 * `lookback` bars and closes back inside: high > ta.highest(high, lookback) and close < ta.highest(high, lookback)
 * (low < ta.lowest(low, lookback) and close > ta.lowest(low, lookback)). The window of ta.highest / ta.lowest
 * includes the current bar, so the high is never above it and the sweep shapes never show (as in the original).
 * The long / short conditions (sweep + EMA cross + trend + Supertrend + RSI) only feed alert() calls, which give no
 * output here. The script works on any chart type; it reads no Renko data.
 *
 * Reference: "Renko Sniper PRO (Liquidity Sweep + EMA + ST + RSI)" by zachsprad
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © zachsprad
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface RenkoSniperProInputs {
  emaFastLen: number;
  emaSlowLen: number;
  /** RSI length (only used by the alert conditions) */
  rsiLen: number;
  atrLen: number;
  factor: number;
  /** Liquidity lookback (bars) */
  lookback: number;
  /** Sweep sensitivity (%): computed by the original script but not used by any output */
  sweepBuffer: number;
}

export const defaultInputs: RenkoSniperProInputs = {
  emaFastLen: 9,
  emaSlowLen: 21,
  rsiLen: 14,
  atrLen: 10,
  factor: 3.0,
  lookback: 10,
  sweepBuffer: 0.1,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaFastLen', type: 'int', title: 'Fast EMA', defval: 9 },
  { id: 'emaSlowLen', type: 'int', title: 'Slow EMA', defval: 21 },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'atrLen', type: 'int', title: 'Supertrend ATR Length', defval: 10 },
  { id: 'factor', type: 'float', title: 'Supertrend Factor', defval: 3.0 },
  { id: 'lookback', type: 'int', title: 'Liquidity Lookback (bars)', defval: 10 },
  { id: 'sweepBuffer', type: 'float', title: 'Sweep Sensitivity (%)', defval: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 9', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'EMA 21', color: color.yellow, lineWidth: 1 },
  { id: 'plot2', title: 'Supertrend', color: color.green, lineWidth: 1 },
];

export const metadata = {
  title: 'Renko Sniper PRO',
  shortTitle: 'Renko Sniper PRO',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<RenkoSniperProInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const close = bars.map((b) => b.close);
  const emaFast = A(ta.ema(S(close), cfg.emaFastLen));
  const emaSlow = A(ta.ema(S(close), cfg.emaSlowLen));
  const [stSeries, dirSeries] = ta.supertrend(bars, cfg.factor, cfg.atrLen);
  const supertrend = A(stSeries);
  const direction = A(dirSeries);
  const highestHigh = A(ta.highest(S(bars.map((b) => b.high)), cfg.lookback));
  const lowestLow = A(ta.lowest(S(bars.map((b) => b.low)), cfg.lookback));

  const finite = (v: number) => (Number.isFinite(v) ? v : NaN);
  const plot0 = bars.map((b, i) => ({ time: b.time, value: finite(emaFast[i]) }));
  const plot1 = bars.map((b, i) => ({ time: b.time, value: finite(emaSlow[i]) }));
  // plot(supertrend, color = direction == 1 ? color.green : color.red)
  const plot2 = bars.map((b, i) => ({
    time: b.time, value: finite(supertrend[i]), color: eq(direction[i], 1) ? color.green : color.red,
  }));

  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    // liquiditySweepLow = low < lowestLow and close > lowestLow
    if (lt(b.low, lowestLow[i]) && gt(b.close, lowestLow[i])) {
      markers.push({ time: b.time as number, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'small' });
    }
    // liquiditySweepHigh = high > highestHigh and close < highestHigh
    if (gt(b.high, highestHigh[i]) && lt(b.close, highestHigh[i])) {
      markers.push({ time: b.time as number, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    markers,
  };
}

export const RenkoSniperPro = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
