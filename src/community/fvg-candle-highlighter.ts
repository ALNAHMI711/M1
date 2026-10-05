/**
 * FVG Candle Highlighter
 *
 * A fair value gap on bar i: a bullish gap when the low of bar i is above the high of bar i - 2, a bearish gap when
 * the high of bar i is below the low of bar i - 2. The middle bar i - 1 (the bar that made the gap) is coloured lime
 * (bullish) or red (bearish), 70 % transparent (barcolor with offset -1).
 *
 * Reference: "FVG Candle Highlighter" by SmellyTaz
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

// The Pine script has no inputs
export interface FvgCandleHighlighterInputs {}

export const defaultInputs: FvgCandleHighlighterInputs = {};

export const inputConfig: InputConfig[] = [];

// No plot(): the only output is a bar colour
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'FVG Candle Highlighter',
  shortTitle: 'FVG Candle Highlighter',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  _inputs: Partial<FvgCandleHighlighterInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  const bullColor = String(color.new(color.lime, 70));
  const bearColor = String(color.new(color.red, 70));
  const barColors: BarColorData[] = [];
  // bars 0 and 1: high[2] / low[2] are na, no gap
  for (let i = 2; i < bars.length; i++) {
    const isBullFVG = gt(bars[i].low, bars[i - 2].high);
    const isBearFVG = lt(bars[i].high, bars[i - 2].low);
    // barcolor(..., offset = -1): the colour of bar i is drawn on bar i - 1
    if (isBullFVG) barColors.push({ time: bars[i - 1].time, color: bullColor });
    else if (isBearFVG) barColors.push({ time: bars[i - 1].time, color: bearColor });
  }
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    barColors,
  };
}

export const FvgCandleHighlighter = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
