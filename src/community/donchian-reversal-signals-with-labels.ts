/**
 * Donchian Reversal Signals with Labels
 *
 * Two Donchian channels (highest high / lowest low over length1 and length2 bars, current bar included). A yellow
 * "B" label below a green candle that follows a red candle whose low is at or below one of the lower bands (bands
 * of the current bar). A green "S" label above a red candle that follows a green candle whose high is at or above
 * one of the upper bands.
 *
 * Reference: "Donchian Reversal Signals with Labels" by Trader-Hitesh
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface DonchianReversalSignalsWithLabelsInputs {
  length1: number;
  length2: number;
}

export const defaultInputs: DonchianReversalSignalsWithLabelsInputs = {
  length1: 20,
  length2: 34,
};

export const inputConfig: InputConfig[] = [
  { id: 'length1', type: 'int', title: 'Donchian Channel Length 1', defval: 20 },
  { id: 'length2', type: 'int', title: 'Donchian Channel Length 2', defval: 34 },
];

// Markers only (plotshape)
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Donchian Reversal Signals with Labels',
  shortTitle: 'Donchian Reversal Signals with Labels',
  overlay: true,
};

/** Pine float comparisons: equal within 1e-10; na compares false */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/** Pine default plotshape text colour (color.blue) */
const TEXT_COLOR = '#2962FF';

export function calculate(
  bars: Bar[],
  inputs: Partial<DonchianReversalSignalsWithLabelsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const { length1, length2 } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const high = new Series(bars, (b) => b.high);
  const low = new Series(bars, (b) => b.low);
  const upper1 = ta.highest(high, length1).toArray();
  const lower1 = ta.lowest(low, length1).toArray();
  const upper2 = ta.highest(high, length2).toArray();
  const lower2 = ta.lowest(low, length2).toArray();
  const num = (x: number | null | undefined) => (x == null ? NaN : x);

  const markers: MarkerData[] = [];
  for (let i = 1; i < n; i++) {
    const b = bars[i];
    const p = bars[i - 1];
    const isGreen = gt(b.close, b.open);
    const isRed = lt(b.close, b.open);
    const prevIsGreen = gt(p.close, p.open);
    const prevIsRed = lt(p.close, p.open);
    const u1 = num(upper1[i]);
    const u2 = num(upper2[i]);
    const l1 = num(lower1[i]);
    const l2 = num(lower2[i]);
    const t = b.time as number;
    if (isGreen && prevIsRed && (le(p.low, l1) || le(p.low, l2))) {
      markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.yellow, text: 'B', textColor: TEXT_COLOR, size: 'auto' });
    }
    if (isRed && prevIsGreen && (ge(p.high, u1) || ge(p.high, u2))) {
      markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.green, text: 'S', textColor: TEXT_COLOR, size: 'auto' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
  };
}

export const DonchianReversalSignalsWithLabels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
