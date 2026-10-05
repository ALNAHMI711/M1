/**
 * <50% Body Candle
 *
 * Marks the candles whose body (|close - open|) is at most a percentage of the high - low range: a white '▪' is drawn
 * at the middle of the body ((open + close) / 2).
 *
 * Reference: "<50% Body Candle" by Dutchinvestor
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface BodyCandle50Inputs {
  /** Maximum body size in % of the high - low range */
  maxBodySize: number;
}

export const defaultInputs: BodyCandle50Inputs = {
  maxBodySize: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'maxBodySize', type: 'float', title: 'Minimal Body Size (%)', defval: 50 },
];

// No plot(): the only output is a plotchar marker
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: '<50% Body Candle',
  shortTitle: '<50% Body Candle',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<BodyCandle50Inputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const white = String(color.new(color.white, 0));
  const markers: MarkerData[] = [];
  for (const b of bars) {
    const midCandleBody = (b.open + b.close) / 2;
    const lowHighRange = ((b.high - b.low) / 100) * cfg.maxBodySize;
    const candleBodySize = ge(b.close, b.open) ? b.close - b.open : b.open - b.close;
    // plotchar(CandleBodySize <= LowHighRange ? MidCandleBody : na, char = '▪', color = color.new(color.white, 0),
    //          location = location.absolute, size = size.tiny)
    if (le(candleBodySize, lowHighRange) && !isNaN(midCandleBody)) {
      markers.push({ time: b.time, position: 'atPriceMiddle', price: midCandleBody, shape: 'circle',
        color: 'transparent', text: '▪', textColor: white, size: 'tiny' });
    }
  }
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
  };
}

export const BodyCandle50 = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
