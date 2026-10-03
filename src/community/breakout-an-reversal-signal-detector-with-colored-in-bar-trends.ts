/**
 * Breakout Signal Detector with Color-Coded Trends
 *
 * The highest high and the lowest low of the previous X bars (the current bar excluded). A close above the highest
 * high is a bullish signal and a close below the lowest low a bearish signal; a repeated signal of the same side
 * also needs the close to be beyond the close of the last opposite breakout (ta.valuewhen, only evaluated on the bars
 * where Pine's lazy `and` / `or` reach it). The candles are green after a bullish signal and red after a bearish
 * signal.
 *
 * Reference: "Breakout an Reversal Signal Detector with Colored in Bar Trends" by AmGlad_Trader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AmGlad_Trader
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';

export interface BreakoutAnReversalSignalDetectorWithColoredInBarTrendsInputs {
  /** Number of previous bars (X) */
  x: number;
}

export const defaultInputs: BreakoutAnReversalSignalDetectorWithColoredInBarTrendsInputs = {
  x: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'x', type: 'int', title: 'Número de velas anteriores (X)', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MAX of Last X Period', color: color.red, lineWidth: 1 },
  { id: 'plot1', title: 'MIN of Last X Period', color: color.green, lineWidth: 1 },
];

export const metadata = {
  title: 'Breakout Signal Detector with Color-Coded Trends',
  shortTitle: 'Breakout Signal Detector with Color-Coded Trends',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<BreakoutAnReversalSignalDetectorWithColoredInBarTrendsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // highest_high = ta.highest(high[1], x), lowest_low = ta.lowest(low[1], x)
  const highest = A(ta.highest(S(bars.map((_b, i) => (i > 0 ? bars[i - 1].high : NaN))), cfg.x));
  const lowest = A(ta.lowest(S(bars.map((_b, i) => (i > 0 ? bars[i - 1].low : NaN))), cfg.x));

  const plot0: { time: number; value: number }[] = [];
  const plot1: { time: number; value: number }[] = [];
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];

  let prevBullishSignal = false; // var bool prev_bullish_signal = false
  let prevBearishSignal = false; // var bool prev_bearish_signal = false
  let inBullishPhase = false; // var bool in_bullish_phase = false
  let inBearishPhase = false; // var bool in_bearish_phase = false
  // ta.valuewhen(close_below_low, close, 0) / ta.valuewhen(close_above_high, close, 0): each call keeps the history
  // of the bars where it runs (the right side of the lazy `and` / `or`)
  let vwBelowLow = NaN;
  let vwAboveHigh = NaN;

  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const t = b.time;
    const closeBelowLow = lt(b.close, lowest[i]);
    const closeAboveHigh = gt(b.close, highest[i]);

    // bullish_condition = close_above_high and (not prev_bullish_signal or ta.valuewhen(close_below_low, close, 0) < close)
    let bullish = false;
    if (closeAboveHigh) {
      if (!prevBullishSignal) bullish = true;
      else {
        if (closeBelowLow) vwBelowLow = b.close;
        bullish = lt(vwBelowLow, b.close);
      }
    }
    // bearish_condition = close_below_low and (not prev_bearish_signal or ta.valuewhen(close_above_high, close, 0) > close)
    let bearish = false;
    if (closeBelowLow) {
      if (!prevBearishSignal) bearish = true;
      else {
        if (closeAboveHigh) vwAboveHigh = b.close;
        bearish = gt(vwAboveHigh, b.close);
      }
    }

    plot0.push({ time: t, value: highest[i] });
    plot1.push({ time: t, value: lowest[i] });
    // plotshape(bearish_condition, shape.triangledown, location.abovebar, color.red, size.tiny)
    if (bearish) markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'tiny' });
    // plotshape(bullish_condition, shape.triangleup, location.belowbar, color.green, size.tiny)
    if (bullish) markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'tiny' });

    if (bullish) {
      inBullishPhase = true;
      inBearishPhase = false;
      prevBullishSignal = true;
      prevBearishSignal = false;
    }
    if (bearish) {
      inBearishPhase = true;
      inBullishPhase = false;
      prevBearishSignal = true;
      prevBullishSignal = false;
    }

    // barcolor(in_bullish_phase ? color.green : na), then barcolor(in_bearish_phase ? color.red : na) on top
    if (inBearishPhase) barColors.push({ time: t, color: color.red });
    else if (inBullishPhase) barColors.push({ time: t, color: color.green });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    markers,
    barColors,
  };
}

export const BreakoutAnReversalSignalDetectorWithColoredInBarTrends = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
