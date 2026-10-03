/**
 * Ichimoku w/Heikin-Ashi
 *
 * Heikin-Ashi candles (close = OHLC average, open = average of the previous Heikin-Ashi open and close; white when
 * the open is below the close, else blue) with Ichimoku lines from Donchian midpoints (average of the lowest low and
 * the highest high): Conversion Line (9), Base Line (26), Leading Span A (average of the two) and Leading Span B (52).
 * The close and both spans are drawn `displacement - 1` bars forward, with a green / dark cloud fill between the
 * spans.
 *
 * Reference: "Ichimoku w/Heikin-Ashi" by yasujiy
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © yasujiy
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import { barInterval, barTime } from '../bar-time';

export interface IchimokuWHeikinAshiInputs {
  /** Conversion Line length */
  conversionPeriods: number;
  /** Base Line length */
  basePeriods: number;
  /** Leading Span B length */
  laggingSpan2Periods: number;
  /** Displacement (the forward plots use displacement - 1) */
  displacement: number;
}

export const defaultInputs: IchimokuWHeikinAshiInputs = {
  conversionPeriods: 9,
  basePeriods: 26,
  laggingSpan2Periods: 52,
  displacement: 26,
};

export const inputConfig: InputConfig[] = [
  { id: 'conversionPeriods', type: 'int', title: 'Conversion Line Length', defval: 9, min: 1 },
  { id: 'basePeriods', type: 'int', title: 'Base Line Length', defval: 26, min: 1 },
  { id: 'laggingSpan2Periods', type: 'int', title: 'Leading Span B Length', defval: 52, min: 1 },
  { id: 'displacement', type: 'int', title: 'Displacement', defval: 26, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Conversion Line', color: '#0000FF', lineWidth: 1 },
  { id: 'plot1', title: 'Base Line', color: '#FF0000', lineWidth: 1 },
  { id: 'plot2', title: 'Leading Lagging Span', color: '#800080', lineWidth: 1 },
  { id: 'plot3', title: 'Leading Span A', color: '#00FF00', lineWidth: 1 },
  { id: 'plot4', title: 'Leading Span B', color: '#008000', lineWidth: 1 },
];

export const metadata = {
  title: 'IchimokuHeikinAshi',
  shortTitle: 'Ichimoku2',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** plotcandle without bordercolor: the style default of the plot (no colorer) */
const CANDLE_BORDER = '#000000';

export function calculate(
  bars: Bar[],
  inputs: Partial<IchimokuWHeikinAshiInputs> = {},
): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // Heikin-Ashi
  const candles: PlotCandleData[] = [];
  let prevOpen = NaN;
  let prevClose = NaN;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const hClose = (b.open + b.high + b.low + b.close) / 4;
    // h_open := na(h_open[1]) ? (open + close) / 2 : (nz(h_open[1]) + nz(h_close[1])) / 2
    const hOpen = isNaN(prevOpen) ? (b.open + b.close) / 2 : (prevOpen + (isNaN(prevClose) ? 0 : prevClose)) / 2;
    const hHigh = Math.max(b.high, Math.max(hOpen, hClose));
    const hLow = Math.min(b.low, Math.min(hOpen, hClose));
    prevOpen = hOpen;
    prevClose = hClose;
    // plotcandle(h_open, h_high, h_low, h_close, color = h_open < h_close ? color.white : color.blue,
    //   wickcolor = color.black)
    if ([hOpen, hHigh, hLow, hClose].every((v) => !isNaN(v))) {
      candles.push({ time: b.time, open: hOpen, high: hHigh, low: hLow, close: hClose,
        color: lt(hOpen, hClose) ? color.white : color.blue, wickColor: color.black, borderColor: CANDLE_BORDER });
    }
  }

  // Ichimoku: donchian(len) => math.avg(ta.lowest(len), ta.highest(len))
  const high = Series.fromArray(bars, bars.map((b) => b.high));
  const low = Series.fromArray(bars, bars.map((b) => b.low));
  const donchian = (len: number) => {
    const ll = A(ta.lowest(low, len));
    const hh = A(ta.highest(high, len));
    return ll.map((l, i) => (l + hh[i]) / 2);
  };
  const conversionLine = donchian(cfg.conversionPeriods);
  const baseLine = donchian(cfg.basePeriods);
  const leadLine1 = conversionLine.map((c, i) => (c + baseLine[i]) / 2);
  const leadLine2 = donchian(cfg.laggingSpan2Periods);

  // plot(..., offset = displacement - 1): the value of bar i is drawn on bar i + displacement - 1
  const k = cfg.displacement - 1;
  const interval = barInterval(bars);
  const shifted = (vals: number[], col: string) => bars.map((_b, i) => ({
    time: barTime(bars, i + k, interval), value: vals[i], color: col,
  }));
  const bull = String(color.rgb(67, 160, 71, 90));
  const bear = String(color.rgb(67, 60, 71, 90));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: conversionLine[i], color: '#0000FF' })),
      plot1: bars.map((b, i) => ({ time: b.time, value: baseLine[i], color: '#FF0000' })),
      plot2: shifted(bars.map((b) => b.close), '#800080'),
      plot3: shifted(leadLine1, '#00FF00'),
      plot4: shifted(leadLine2, '#008000'),
    },
    // fill(p1, p2, color = leadLine1 > leadLine2 ? color.rgb(67, 160, 71, 90) : color.rgb(67, 60, 71, 90)); the fill
    // colour of bar i goes with the plot points of bar i
    fills: [{ plot1: 'plot3', plot2: 'plot4', colors: leadLine1.map((a, i) => (gt(a, leadLine2[i]) ? bull : bear)) }],
    plotCandles: { haCandles: candles },
  };
}

export const IchimokuWHeikinAshi = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
