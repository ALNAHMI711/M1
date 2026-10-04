/**
 * Kiss Of Death
 *
 * A 21-bar EMA of the close and a sell signal: the close is below the EMA, the previous close is at or above the
 * current EMA, and the low is below the lowest low of the two previous bars. The signal is a red triangle above the
 * bar with the text "kiss_of_death".
 *
 * Reference: "Kiss Of Death" by thanos300693
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © thanos300693
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface KissOfDeathInputs {}

export const defaultInputs: KissOfDeathInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '21 EMA', color: color.blue, lineWidth: 1 },
];

export const metadata = {
  title: 'Kiss Of Death',
  shortTitle: 'Kiss Of Death',
  overlay: true,
};

/** Pine float comparisons: a < b only when b - a > 1e-10, a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(
  bars: Bar[],
  _inputs: Partial<KissOfDeathInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const ema21 = A(ta.ema(Series.fromArray(bars, bars.map((b) => b.close)), 21));
  const lowest2 = A(ta.lowest(Series.fromArray(bars, bars.map((b) => b.low)), 2));

  const markers: MarkerData[] = [];
  for (let i = 1; i < n; i++) {
    const b = bars[i];
    const prevLow = lowest2[i - 1]; // ta.lowest(low, 2)[1]
    // close < ema21 and close[1] >= ema21 and low < prev_low
    if (lt(b.close, ema21[i]) && ge(bars[i - 1].close, ema21[i]) && lt(b.low, prevLow)) {
      markers.push({
        time: b.time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'auto',
        text: 'kiss_of_death', textColor: color.white,
      });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: ema21[i], color: color.blue })),
    },
    markers,
  };
}

export const KissOfDeath = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
