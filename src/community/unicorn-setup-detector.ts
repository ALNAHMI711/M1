/**
 * Unicorn Setup Detector
 *
 * Breaker levels from the 3-bar highest high / lowest low and a "fair value gap" from the 2-bar high - low range.
 * Bullish zone = lowest low (3) + gap / 2, bearish zone = highest high (3) - gap / 2. A buy triangle marks a close
 * crossing above the bullish zone, a sell triangle a close crossing below the bearish zone; both are drawn one bar
 * back (Pine offset = -1).
 *
 * Reference: "Unicorn Setup Detector" by mohammedazizabid
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { barInterval, barTime } from '../bar-time';

// The Pine script has no input
export interface UnicornSetupDetectorInputs {}

export const defaultInputs: UnicornSetupDetectorInputs = {};

export const inputConfig: InputConfig[] = [];

// No plot(): the outputs are plotshape triangles
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Unicorn Setup Detector',
  shortTitle: 'Unicorn Setup Detector',
  overlay: true,
};

export function calculate(
  bars: Bar[],
  _inputs: Partial<UnicornSetupDetectorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const n = bars.length;
  const S = (a: number[]) => Series.fromArray(bars, a);
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const high = S(bars.map((b) => b.high));
  const low = S(bars.map((b) => b.low));

  // hhll(high, low): ta.highest(high, 3), ta.lowest(low, 3)
  const highestHigh = A(ta.highest(high, 3));
  const lowestLow = A(ta.lowest(low, 3));
  // prevHigh / prevLow (ta.valuewhen) are not used by any output
  // fvgBullish = fvgBearish = ta.highest(high, 2) - ta.lowest(low, 2)
  const low2 = A(ta.lowest(low, 2));
  const range2 = A(ta.highest(high, 2)).map((h, i) => h - low2[i]);
  const unicornZoneBullish = lowestLow.map((v, i) => v + range2[i] / 2);
  const unicornZoneBearish = highestHigh.map((v, i) => v - range2[i] / 2);

  // ta.crossover / ta.crossunder: exact comparisons (library functions)
  const close = S(bars.map((b) => b.close));
  const bullishRetest = ta.crossover(close, S(unicornZoneBullish)).toArray().map((v) => !!v);
  const bearishRetest = ta.crossunder(close, S(unicornZoneBearish)).toArray().map((v) => !!v);

  const interval = barInterval(bars);
  const markers: MarkerData[] = [];
  for (let i = 1; i < n; i++) {
    const t = barTime(bars, i - 1, interval);
    // plotshape(bullishRetest, "Buy Signal", shape.triangleup, location.belowbar, color.blue, size.tiny, offset = -1)
    if (bullishRetest[i]) {
      markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.blue, size: 'tiny' });
    }
    // plotshape(bearishRetest, "Sell Signal", shape.triangledown, location.abovebar, color.red, size.tiny, offset = -1)
    if (bearishRetest[i]) {
      markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'tiny' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
  };
}

export const UnicornSetupDetector = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
