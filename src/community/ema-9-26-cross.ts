/**
 * EMA 9 / 26 Cross
 *
 * The EMA 9 and the EMA 26 of the close. An X mark is drawn at the EMA 9 value on the bars where the EMA 9 crosses
 * above (Buy X) or below (Sell X) the EMA 26.
 *
 * Reference: "EMA 9 / 26 Cross" by h0s1m001
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © h0s1m001
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

/** The Pine script has no inputs */
export interface Ema926CrossInputs {}

export const defaultInputs: Ema926CrossInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 9', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'EMA 26', color: color.blue, lineWidth: 1 },
];

export const metadata = {
  title: 'EMA 9 / 26 Cross',
  shortTitle: 'EMA 9 / 26 Cross',
  overlay: true,
};

export function calculate(
  bars: Bar[],
  _inputs: Partial<Ema926CrossInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = Series.fromArray(bars, bars.map((b) => b.close));
  const fastS = ta.ema(close, 9);
  const slowS = ta.ema(close, 26);
  const fast = A(fastS);
  const slow = A(slowS);
  const bull = A(ta.crossover(fastS, slowS));
  const bear = A(ta.crossunder(fastS, slowS));

  const markers: MarkerData[] = [];
  bars.forEach((b, i) => {
    // plotshape(bullCross ? fastEMA : na, "Buy X", shape.xcross, location.absolute, size.normal, color.blue)
    if (bull[i] && !isNaN(fast[i])) {
      markers.push({ time: b.time, position: 'atPriceMiddle', price: fast[i], shape: 'xcross', color: color.blue, size: 'normal' });
    }
    if (bear[i] && !isNaN(fast[i])) {
      markers.push({ time: b.time, position: 'atPriceMiddle', price: fast[i], shape: 'xcross', color: color.blue, size: 'normal' });
    }
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: fast[i] })),
      plot1: bars.map((b, i) => ({ time: b.time, value: slow[i] })),
    },
    markers,
  };
}

export const Ema926Cross = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
