/**
 * IU Mean Reversion System
 *
 * The mean is the RMA (9) of the EMA (9) of the close. The bands are the mean +- ATR * multiplier. A long trade
 * starts when the close crosses over the lower band and ends when the high crosses over the mean; a short trade
 * starts when the close crosses under the upper band and ends when the low crosses under the mean. Labels mark the
 * entries and exits. The "Mean length" input is not used by the original script (the lengths are fixed at 9).
 *
 * Reference: "IU Mean Reversion System" by Shivam_Mandrai
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Shivam_Mandrai
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface IUMeanReversionSystemInputs {
  /** Mean length (not used by the original script: the EMA and RMA lengths are fixed at 9) */
  meanLength: number;
  /** ATR length */
  atrLength: number;
  /** ATR multiplier of the bands */
  multi: number;
}

export const defaultInputs: IUMeanReversionSystemInputs = {
  meanLength: 9,
  atrLength: 100,
  multi: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'meanLength', type: 'int', title: 'Mean length = ', defval: 9 },
  { id: 'atrLength', type: 'int', title: 'ATR Length = ', defval: 100 },
  { id: 'multi', type: 'float', title: 'Multiplier', defval: 3 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Mean', color: color.lime, lineWidth: 1 },
  { id: 'plot1', title: 'Upper', color: color.gray, lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: color.gray, lineWidth: 1 },
];

const FILL_COLOR = String(color.new(color.blue, 90));

/** fill(upper_plot, lower_plot, color.new(color.blue, 90)) */
export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot1', plot2: 'plot2', color: FILL_COLOR },
];

export const metadata = {
  title: 'IU Mean Reversion System',
  shortTitle: 'IU Mean Reversion System',
  overlay: true,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<IUMeanReversionSystemInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  const close = Series.fromArray(bars, bars.map((b) => b.close));
  const ema = ta.ema(close, 9);
  const mean = A(ta.rma(ema, 9));
  const atr = A(ta.atr(bars, cfg.atrLength));
  const upper = mean.map((m, i) => m + atr[i] * cfg.multi);
  const lower = mean.map((m, i) => m - atr[i] * cfg.multi);

  // ta.crossover(a, b): a > b and a[1] <= b[1]; ta.crossunder(a, b): a < b and a[1] >= b[1]; exact comparisons
  // (na compares false; the bands and the mean are never na again after their first value)
  const crossover = (a: (i: number) => number, b: number[], i: number) => i > 0 && a(i) > b[i] && a(i - 1) <= b[i - 1];
  const crossunder = (a: (i: number) => number, b: number[], i: number) => i > 0 && a(i) < b[i] && a(i - 1) >= b[i - 1];
  const closeAt = (i: number) => bars[i].close;
  const highAt = (i: number) => bars[i].high;
  const lowAt = (i: number) => bars[i].low;

  const markers: MarkerData[] = [];
  const white = color.white;
  let inLong = false; // var in_long = false
  let inShort = false; // var in_short = false
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const long = crossover(closeAt, lower, i);
    const short = crossunder(closeAt, upper, i);
    const longExit = crossover(highAt, mean, i);
    const shortExit = crossunder(lowAt, mean, i);
    // in_long[1] / in_short[1]: false on the first bar
    const prevLong = inLong;
    const prevShort = inShort;
    if (long && !inLong) inLong = true;
    if (short && !inShort) inShort = true;
    if (longExit) inLong = false;
    if (shortExit) inShort = false;

    // plotshape(long_exit and in_long[1], "Long Exit", shape.labeldown, location.abovebar, color.gray)
    if (longExit && prevLong) {
      markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.gray, text: 'Long Exit', textColor: white });
    }
    // plotshape(short_exit and in_short[1], "Short Exit", shape.labelup, location.belowbar, color.gray)
    if (shortExit && prevShort) {
      markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.gray, text: 'Short Exit', textColor: white });
    }
    // plotshape(in_long and not in_long[1], "Long Entry", shape.labelup, location.belowbar, color.green)
    if (inLong && !prevLong) {
      markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'Long Entry', textColor: white });
    }
    // plotshape(in_short and not in_short[1], "Short Entry", shape.labeldown, location.abovebar, color.red)
    if (inShort && !prevShort) {
      markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'Short Entry', textColor: white });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: mean[i], color: color.lime })),
      plot1: bars.map((b, i) => ({ time: b.time, value: upper[i], color: color.gray })),
      plot2: bars.map((b, i) => ({ time: b.time, value: lower[i], color: color.gray })),
    },
    fills: [{ plot1: 'plot1', plot2: 'plot2', colors: new Array<string>(n).fill(FILL_COLOR) }],
    markers,
  };
}

export const IUMeanReversionSystem = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
};
