/**
 * Strong Engulfing Candlestick (With Alerts)
 *
 * Bullish engulfing: a green bar after a red bar, with a high at or above the previous high, a low at or below the
 * previous low and a body larger than the previous body. Bearish engulfing: the same with a red bar after a green
 * bar. A green label below the bar marks a bullish engulfing, a red label above the bar a bearish engulfing.
 *
 * Reference: "Strong Engulfing Candlestick (With Alerts)" by kyjefive
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export type StrongEngulfingCandlestickInputs = Record<string, never>;

export const defaultInputs: StrongEngulfingCandlestickInputs = {};

export const inputConfig: InputConfig[] = [];

// Only markers (plotshape): no line plots
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Strong Engulfing Candlestick (With Alerts)',
  shortTitle: 'Strong Engulfing Candlestick (With Alerts)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

export function calculate(
  bars: Bar[],
  _inputs: Partial<StrongEngulfingCandlestickInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const markers: MarkerData[] = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    const p = bars[i - 1];
    const bullish = gt(b.close, b.open) && lt(p.close, p.open) && ge(b.high, p.high) && le(b.low, p.low)
      && gt(b.close - b.open, p.open - p.close);
    const bearish = lt(b.close, b.open) && gt(p.close, p.open) && ge(b.high, p.high) && le(b.low, p.low)
      && gt(b.open - b.close, p.close - p.open);
    // plotshape(bullish_engulfing, location.belowbar, shape.labelup, color.green, size = size.small)
    if (bullish) markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.green, size: 'small' });
    // plotshape(bearish_engulfing, location.abovebar, shape.labeldown, color.red, size = size.small)
    if (bearish) markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, size: 'small' });
  }
  // alertcondition(bullish_engulfing / bearish_engulfing): alerts only, not ported

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
  };
}

export const StrongEngulfingCandlestick = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
