/**
 * NY ORB + Fakeout Detector
 *
 * Opening range of one fixed window: the bars whose open time is from 2025-06-03 13:30 to 13:45 UTC (the times are
 * constants of the script) build the range high / low; the range is cleared on the first bar after the window. A
 * shape marks the bars that close above the range high after an open below it, with an upper wick of more than half
 * the bar range. Outside that window (e.g. on daily bars other than 2025-06-03) the plots are na.
 *
 * Reference: "NY ORB + Fakeout Detector" by STEFANGAS
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface NyOrbFakeoutDetectorInputs {}

export const defaultInputs: NyOrbFakeoutDetectorInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ORB High', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'ORB Low', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'NY ORB + Fakeout Detector',
  shortTitle: 'NY ORB + Fakeout Detector',
  overlay: true,
};

/** Pine default colour of a plotshape without a colour */
const PINE_BLUE = '#2962FF';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

// orb_start = timestamp("2025-06-03T13:30:00"); orb_end = timestamp("2025-06-03T13:45:00"): a date string without a
// time zone is UTC (bar times in seconds)
const ORB_START = Date.UTC(2025, 5, 3, 13, 30, 0) / 1000;
const ORB_END = Date.UTC(2025, 5, 3, 13, 45, 0) / 1000;

export function calculate(
  bars: Bar[],
  _inputs: Partial<NyOrbFakeoutDetectorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const n = bars.length;
  const high: number[] = new Array(n);
  const low: number[] = new Array(n);
  const markers: MarkerData[] = [];
  let orbHigh = NaN; // var float orb_high = na
  let orbLow = NaN;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const inOrb = b.time >= ORB_START && b.time <= ORB_END;
    if (inOrb) {
      orbHigh = isNaN(orbHigh) ? b.high : Math.max(orbHigh, b.high);
      orbLow = isNaN(orbLow) ? b.low : Math.min(orbLow, b.low);
    }
    if (b.time > ORB_END && !inOrb) {
      orbHigh = NaN;
      orbLow = NaN;
    }
    high[i] = orbHigh;
    low[i] = orbLow;
    // breakout_up = close > orb_high and open < orb_high and high - close > (high - low) * 0.5
    const breakoutUp = gt(b.close, orbHigh) && lt(b.open, orbHigh) && gt(b.high - b.close, (b.high - b.low) * 0.5);
    // plotshape(breakout_up): shape.xcross above the bar, default colour
    if (breakoutUp) markers.push({ time: b.time, position: 'aboveBar', shape: 'xcross', color: PINE_BLUE });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: high[i], color: color.green })),
      plot1: bars.map((b, i) => ({ time: b.time, value: low[i], color: color.red })),
    },
    markers,
  };
}

export const NyOrbFakeoutDetector = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
