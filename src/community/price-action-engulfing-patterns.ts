/**
 * Price Action: Engulfing Patterns
 *
 * Bullish engulfing: the previous bar is red (close < open), the current bar is green, its close is at or above the
 * previous open and its open is at or below the previous close. Bearish engulfing is the mirror pattern. Labels mark
 * the patterns; a line plots the close.
 *
 * Reference: "Price Action: Engulfing Patterns" by Jay9286
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Jay9286
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

// The Pine script has no inputs
export interface PriceActionEngulfingPatternsInputs {}

export const defaultInputs: PriceActionEngulfingPatternsInputs = {};

export const inputConfig: InputConfig[] = [];

/** Pine default plot colour */
const PINE_BLUE = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: PINE_BLUE, lineWidth: 1 },
];

export const metadata = {
  title: 'Price Action: Engulfing Patterns',
  shortTitle: 'Price Action: Engulfing Patterns',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

export function calculate(
  bars: Bar[],
  _inputs: Partial<PriceActionEngulfingPatternsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const markers: MarkerData[] = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    const p = bars[i - 1];
    // bullish_engulfing = close[1] < open[1] and close > open and close >= open[1] and open <= close[1]
    const bullish = lt(p.close, p.open) && gt(b.close, b.open) && ge(b.close, p.open) && le(b.open, p.close);
    // bearish_engulfing = close[1] > open[1] and close < open and open >= close[1] and close <= open[1]
    const bearish = gt(p.close, p.open) && lt(b.close, b.open) && ge(b.open, p.close) && le(b.close, p.open);
    // plotshape(..., location.belowbar, color.green, shape.labelup, text = "Bullish Engulfing"): default text colour
    if (bullish) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.green,
        text: 'Bullish Engulfing', textColor: PINE_BLUE, size: 'auto' });
    }
    if (bearish) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red,
        text: 'Bearish Engulfing', textColor: PINE_BLUE, size: 'auto' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    // plot(close)
    plots: { plot0: bars.map((b) => ({ time: b.time, value: b.close, color: PINE_BLUE })) },
    markers,
  };
}

export const PriceActionEngulfingPatterns = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
