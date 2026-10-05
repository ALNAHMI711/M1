/**
 * No Wick Candles
 *
 * Marks bars that open on their extreme. A bar with open == low gets an orange bar colour, and a green label under
 * the bar when it closes up. A bar with open == high gets an orange bar colour, and a red label above the bar when
 * it closes down. The script has no plot: the outputs are the two label series and two bar colour layers (the
 * second layer, open == high, is drawn over the first).
 *
 * Reference: "No wick candles" by KORD_
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Created by KORD
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface NoWickCandlesInputs {}

export const defaultInputs: NoWickCandlesInputs = {};

export const inputConfig: InputConfig[] = [];

// No plot: markers and bar colours only
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'No wick candles',
  shortTitle: 'No wick candles',
  overlay: true,
};

/** Pine float comparisons: equal within 1e-10, a > b only when a - b > 1e-10 */
const EPS = 1e-10;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

const UP_COLOR = String(color.rgb(55, 136, 58));
const DOWN_COLOR = String(color.rgb(172, 48, 48));
const NO_LOWER_WICK_BAR = '#F0B65EEF';
const NO_UPPER_WICK_BAR = '#F0B65E';

export function calculate(
  bars: Bar[],
  _inputs: Partial<NoWickCandlesInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  for (const b of bars) {
    const noLowerWick = eq(b.open, b.low);
    const noUpperWick = eq(b.open, b.high);
    if (gt(b.close, b.open) && noLowerWick) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: UP_COLOR, size: 'small' });
    }
    if (lt(b.close, b.open) && noUpperWick) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: DOWN_COLOR, size: 'small' });
    }
    // Two barcolor calls: the later one (open == high) is drawn over the first
    if (noUpperWick) barColors.push({ time: b.time, color: NO_UPPER_WICK_BAR });
    else if (noLowerWick) barColors.push({ time: b.time, color: NO_LOWER_WICK_BAR });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    barColors,
  };
}

export const NoWickCandles = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
