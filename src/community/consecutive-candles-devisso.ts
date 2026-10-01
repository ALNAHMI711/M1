/**
 * Consecutive Candles DevisSo
 *
 * Plots the 50 % level ((open + close) / 2) and the 23.6 % level (open + (close - open) * 0.236) of the three
 * previous candles. A rising sequence is three candles whose low stays above the 50 % level of the candle before
 * (low > 50 % of bar 1, low[1] > 50 % of bar 2, low[2] > 50 % of bar 3); a falling sequence is the same with the
 * high below the 50 % levels. The first rising sequence after a non-long state stores the low as the long pullback
 * level; the first falling sequence after a non-short state stores the high as the short pullback level. The
 * pullback line is the mean of both levels; close crossing over / under it gives a 'CR' signal.
 *
 * Reference: "Consecutive Candles DevisSo" by engineerofmoney
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { callsite, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

// The Pine script has no inputs
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ConsecutiveCandlesDevissoInputs {}

export const defaultInputs: ConsecutiveCandlesDevissoInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '1. Mum %50', color: color.red, lineWidth: 1 },
  { id: 'plot1', title: '2. Mum %50', color: color.orange, lineWidth: 1 },
  { id: 'plot2', title: '3. Mum %50', color: color.yellow, lineWidth: 1 },
  { id: 'plot3', title: '1. Mum %23.6', color: color.purple, lineWidth: 1 },
  { id: 'plot4', title: '2. Mum %23.6', color: color.blue, lineWidth: 1 },
  { id: 'plot5', title: '3. Mum %23.6', color: color.green, lineWidth: 1 },
  { id: 'plot6', title: 'Long Pullback Level', color: '#ee0ab5', lineWidth: 2, style: 'stepline' },
];

export const metadata = {
  title: 'Consecutive Candles DevisSo',
  shortTitle: 'Consecutive Candles DevisSo',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  _inputs: Partial<ConsecutiveCandlesDevissoInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const n = bars.length;
  const val = (k: number, i: number, f: (b: Bar) => number) => (i - k >= 0 ? f(bars[i - k]) : NaN);
  const open = (i: number, k: number) => val(k, i, (b) => b.open);
  const close = (i: number, k: number) => val(k, i, (b) => b.close);
  const high = (i: number, k: number) => val(k, i, (b) => b.high);
  const low = (i: number, k: number) => val(k, i, (b) => b.low);
  const fifty = (i: number, k: number) => (open(i, k) + close(i, k)) / 2;
  const level236 = (i: number, k: number) => open(i, k) + (close(i, k) - open(i, k)) * 0.236;

  const plots: Record<string, { time: number; value: number; color: string }[]> = {};
  const colours = plotConfig.map((p) => p.color);
  for (let p = 0; p < 7; p++) plots[`plot${p}`] = [];
  const markers: MarkerData[] = [];

  let lastSignal = 0; // var int last_signal = 0
  let longLevel = NaN; // var float long_pullback_level = na
  let shortLevel = NaN; // var float short_pullback_level = na
  // ta.crossover / ta.crossunder: exact comparisons (a tie on the previous bar counts), false on the first bar
  const crossOver = callsite.crossover();
  const crossUnder = callsite.crossunder();
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const f1 = fifty(i, 1);
    const f2 = fifty(i, 2);
    const f3 = fifty(i, 3);
    const rise = gt(low(i, 1), f2) && gt(low(i, 2), f3) && gt(low(i, 0), f1);
    const fall = lt(high(i, 1), f2) && lt(high(i, 2), f3) && lt(high(i, 0), f1);

    const longCond = rise && lastSignal !== 1;
    if (longCond) lastSignal = 1;
    const shortCond = fall && lastSignal !== -1;
    if (shortCond) lastSignal = -1;
    if (longCond) longLevel = bars[i].low;
    if (shortCond) shortLevel = bars[i].high;
    const collatz = (longLevel + shortLevel) / 2;

    const values = [f1, f2, f3, level236(i, 1), level236(i, 2), level236(i, 3), collatz];
    values.forEach((v, p) => plots[`plot${p}`].push({ time: t, value: v, color: colours[p] }));

    // ta.crossover(close, collatz) / ta.crossunder(close, collatz)
    const c = bars[i].close;
    const longSignal = crossOver(c, collatz);
    const shortSignal = crossUnder(c, collatz);
    // plotshape(long_signal2, location.belowbar, color.green, shape.triangleup, text 'CR', size.tiny, textcolor color.green)
    if (longSignal) {
      markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.green, text: 'CR',
        textColor: color.green, size: 'tiny' });
    }
    // plotshape(short_signal2, location.abovebar, #c50fda, shape.triangledown, text 'CR', size.tiny, textcolor color.red)
    if (shortSignal) {
      markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: '#c50fda', text: 'CR',
        textColor: color.red, size: 'tiny' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    markers,
  };
}

export const ConsecutiveCandlesDevisso = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
