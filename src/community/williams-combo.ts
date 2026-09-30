/**
 * Bill Williams Alligator + Fractals
 *
 * Alligator: 3 SMMA (RMA) lines on HL2 with forward offsets.
 * Jaw = RMA(hl2, 13) shifted 8 bars, Teeth = RMA(hl2, 8) shifted 5, Lips = RMA(hl2, 5) shifted 3.
 * Fractals: 5-bar fractal high/low detection (Pine rule, equal highs/lows allowed before the fractal bar).
 * Resistance: valuewhen(high >= highest(high, lengthRS), high, 0) - held until new fractal high.
 * Support: valuewhen(low <= lowest(low, lengthRS), low, 0) - held until new fractal low.
 *
 * Reference: "Bill Williams Alligator + Fractals + S/R" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface WilliamsComboInputs {
  lengthRS: number;
}

export const defaultInputs: WilliamsComboInputs = {
  lengthRS: 13,
};

export const inputConfig: InputConfig[] = [
  { id: 'lengthRS', type: 'int', title: 'Res-Sup Length', defval: 13, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Jaw', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Teeth', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'Lips', color: '#26A69A', lineWidth: 1 },
  { id: 'plot3', title: 'Resistance', color: '#808000', lineWidth: 1, style: 'linebr' },
  { id: 'plot4', title: 'Support', color: '#800000', lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Williams Alligator + Fractals',
  shortTitle: 'WilliamsCombo',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<WilliamsComboInputs> = {}): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const { lengthRS } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const hl2Series = new Series(bars, (b) => (b.high + b.low) / 2);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  // SMMA = RMA
  const jawRaw = ta.rma(hl2Series, 13).toArray();
  const teethRaw = ta.rma(hl2Series, 8).toArray();
  const lipsRaw = ta.rma(hl2Series, 5).toArray();

  // Shift forward by padding NaN at start
  const shift = (arr: number[], offset: number): number[] => {
    const result: number[] = new Array(n).fill(NaN);
    for (let i = 0; i < n - offset; i++) {
      result[i + offset] = arr[i];
    }
    return result;
  };

  const jawArr = shift(jawRaw, 8);
  const teethArr = shift(teethRaw, 5);
  const lipsArr = shift(lipsRaw, 3);

  // Fractals (Pine n = 2, 5 clauses): the 2 bars after the fractal bar are strictly beyond it; before it, up to 4
  // equal (or beyond) bars, then 2 strictly beyond bars.
  // `beyond(a, x)`: a is lower than x (high fractal) or higher than x (low fractal). NaN before the first bar.
  const isFractal = (c: number, v: (j: number) => number, beyond: (a: number, x: number) => boolean): boolean => {
    const x = v(c);
    if (!(c + 2 < n && beyond(v(c + 1), x) && beyond(v(c + 2), x))) return false;
    const b = (k: number) => (c - k >= 0 ? v(c - k) : NaN); // k bars before the fractal bar
    const bEq = (k: number) => b(k) === x;
    const bLe = (k: number) => beyond(b(k), x) || b(k) === x;
    return (beyond(b(2), x) && beyond(b(1), x)) ||
      (beyond(b(3), x) && beyond(b(2), x) && bEq(1)) ||
      (beyond(b(4), x) && beyond(b(3), x) && bEq(2) && bLe(1)) ||
      (beyond(b(5), x) && beyond(b(4), x) && bEq(3) && bEq(2) && bLe(1)) ||
      (beyond(b(6), x) && beyond(b(5), x) && bEq(4) && bLe(3) && bEq(2) && bLe(1));
  };
  const highAt = (j: number) => bars[j].high;
  const lowAt = (j: number) => bars[j].low;
  const below = (a: number, x: number) => a < x;
  const above = (a: number, x: number) => a > x;

  // Pine: highRS = valuewhen(high >= highest(high, lengthRS), high, 0)
  // Pine: lowRS  = valuewhen(low  <= lowest(low, lengthRS),  low, 0)
  // Resistance line holds value; breaks (na) when value changes.
  const hhArr = ta.highest(highSeries, lengthRS).toArray();
  const llArr = ta.lowest(lowSeries, lengthRS).toArray();

  const markers: MarkerData[] = [];
  let highRS = NaN;
  let lowRS = NaN;
  let prevHighRS = NaN;
  let prevLowRS = NaN;

  const plot3: { time: number; value: number }[] = [];
  const plot4: { time: number; value: number }[] = [];

  for (let i = 0; i < n; i++) {
    // Shapes drawn on the fractal bar (Pine offset=-2)
    if (isFractal(i, highAt, below)) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#EF5350', text: 'F' });
    }
    if (isFractal(i, lowAt, above)) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#26A69A', text: 'F' });
    }

    // Save previous raw values before updating (Pine: highRS[1], lowRS[1])
    prevHighRS = highRS;
    prevLowRS = lowRS;

    // Pine: highRS = valuewhen(high >= highest(high, lengthRS), high, 0)
    if (i >= lengthRS && bars[i].high >= hhArr[i]) {
      highRS = bars[i].high;
    }
    // Pine: lowRS = valuewhen(low <= lowest(low, lengthRS), low, 0)
    if (i >= lengthRS && bars[i].low <= llArr[i]) {
      lowRS = bars[i].low;
    }

    // Pine: color = highRS != highRS[1] ? na : olive (break line when level changes)
    const resVal = (i < lengthRS || isNaN(highRS)) ? NaN : (highRS !== prevHighRS && i > 0 ? NaN : highRS);
    const supVal = (i < lengthRS || isNaN(lowRS)) ? NaN : (lowRS !== prevLowRS && i > 0 ? NaN : lowRS);

    plot3.push({ time: bars[i].time, value: resVal });
    plot4.push({ time: bars[i].time, value: supVal });
  }

  const warmup = 13;
  const plot0 = jawArr.map((v, i) => ({ time: bars[i].time, value: i < warmup || isNaN(v) ? NaN : v }));
  const plot1 = teethArr.map((v, i) => ({ time: bars[i].time, value: i < warmup || isNaN(v) ? NaN : v }));
  const plot2 = lipsArr.map((v, i) => ({ time: bars[i].time, value: i < warmup || isNaN(v) ? NaN : v }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'plot4': plot4 },
    markers,
  };
}

export const WilliamsCombo = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
