/**
 * EMA Cross Signals
 *
 * A fast EMA (20) and a slow EMA (50) of the close. A BUY triangle below the bar when the fast EMA crosses over the
 * slow EMA, a SELL triangle above the bar when it crosses under.
 *
 * Reference: "EMA Cross Signals" by Jos-ProTrader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Jos-ProTrader
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

// The Pine script has no inputs
export interface EmaCrossSignalsInputs {}

export const defaultInputs: EmaCrossSignalsInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'Slow EMA', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'EMA Cross Signals',
  shortTitle: 'EMA Cross Signals',
  overlay: true,
};

export function calculate(
  bars: Bar[],
  _inputs: Partial<EmaCrossSignalsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = Series.fromArray(bars, bars.map((b) => b.close));
  const fastS = ta.ema(close, 20);
  const slowS = ta.ema(close, 50);
  const fast = A(fastS);
  const slow = A(slowS);
  // ta.crossover / ta.crossunder: exact comparisons with the last bar where both values were not na
  const buy = ta.crossover(fastS, slowS).toArray();
  const sell = ta.crossunder(fastS, slowS).toArray();

  const markers: MarkerData[] = [];
  for (let i = 0; i < bars.length; i++) {
    const t = bars[i].time;
    // plotshape(buy, style = shape.triangleup, location = location.belowbar, color = color.lime, text = "BUY")
    // (Pine default text colour #2962FF)
    if (buy[i] === 1) {
      markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.lime, text: 'BUY', textColor: '#2962FF' });
    }
    // plotshape(sell, style = shape.triangledown, location = location.abovebar, color = color.red, text = "SELL")
    if (sell[i] === 1) {
      markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.red, text: 'SELL', textColor: '#2962FF' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // plot(fast, color = color.green); plot(slow, color = color.red)
      plot0: bars.map((b, i) => ({ time: b.time, value: fast[i], color: color.green })),
      plot1: bars.map((b, i) => ({ time: b.time, value: slow[i], color: color.red })),
    },
    markers,
  };
}

export const EmaCrossSignals = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
