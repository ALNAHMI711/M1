/**
 * Engulfing Candle Indicator
 *
 * Keeps the open and bar of the last bullish candle and of the last bearish candle. A bullish engulfing: the close
 * is above the open of the last bearish candle (an earlier bar) and above the previous low. A bearish engulfing: the
 * close is below the open of the last bullish candle (an earlier bar) and below the previous high. A signal is not
 * repeated: a bullish signal needs the last signal to be other than bullish, and the same for bearish.
 *
 * Reference: "Engulfing Candle Indicator" by The_Forex_Steward
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Created by D'Andre B
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

// The Pine script has no input
export interface EngulfingCandleIndicatorInputs {}

export const defaultInputs: EngulfingCandleIndicatorInputs = {};

export const inputConfig: InputConfig[] = [];

// No plot(): plotshape markers only
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Engulfing Candle Indicator',
  shortTitle: 'Engulfing Candle Indicator',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  _inputs: Partial<EngulfingCandleIndicatorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  let lastBullishOpen = NaN;
  let lastBearishOpen = NaN;
  let lastBullishIndex = NaN;
  let lastBearishIndex = NaN;
  let lastSignal = '';

  const markers: MarkerData[] = [];
  bars.forEach((b, i) => {
    const low1 = i > 0 ? bars[i - 1].low : NaN;
    const high1 = i > 0 ? bars[i - 1].high : NaN;

    const isBullish = gt(b.close, b.open);
    const isBearish = lt(b.close, b.open);

    if (isBullish) {
      lastBullishOpen = b.open;
      lastBullishIndex = i;
    } else if (isBearish) {
      lastBearishOpen = b.open;
      lastBearishIndex = i;
    }

    // bar_index > lastIndex: na compares false (the index counts from the first bar; only the order matters)
    const bullishEngulfing = !isNaN(lastBearishOpen) && gt(b.close, lastBearishOpen) && gt(b.close, low1)
      && i > lastBearishIndex;
    const bearishEngulfing = !isNaN(lastBullishOpen) && lt(b.close, lastBullishOpen) && lt(b.close, high1)
      && i > lastBullishIndex;

    const bullishEngulfingSignal = bullishEngulfing && lastSignal !== 'bullish';
    const bearishEngulfingSignal = bearishEngulfing && lastSignal !== 'bearish';

    if (bullishEngulfingSignal) lastSignal = 'bullish';
    if (bearishEngulfingSignal) lastSignal = 'bearish';

    if (bullishEngulfingSignal) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'tiny' });
    }
    if (bearishEngulfingSignal) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'tiny' });
    }
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
  };
}

export const EngulfingCandleIndicator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
