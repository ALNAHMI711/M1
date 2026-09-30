/**
 * Dynamic Trend Bands
 *
 * Base line: a double Hull moving average of close, HMA(HMA(close, length - 10), length). The upper and lower bands
 * are the base +/- ATR(100) * distance. The lower band is drawn only while it is not below its value `size` bars
 * ago (rising or flat), as two lines (current value and value `size` bars ago) with a fill between them and a
 * middle line; the upper band is drawn only while it is not above its value `size` bars ago (falling or flat).
 * Optional orange bar colours mark a high above a falling upper band or a low below a rising lower band.
 * The Pine input "Source" is not used by the Pine calculation (the double HMA uses close), as in Pine.
 *
 * Reference: "Dynamic Trend Bands [ChartPrime]" by ChartPrime
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface DynamicTrendBandsInputs {
  /** Double HMA length (the inner HMA uses length - 10) */
  length: number;
  /** Pine input "Source": not used by the Pine calculation */
  src: SourceType;
  /** ATR(100) multiplier of the band distance */
  multi: number;
  /** Band size: bars back for the band comparison and the second band line */
  bandSize: number;
  colUp: string;
  colMid: string;
  colDn: string;
  /** Momentum shift bar colours */
  barsCol: boolean;
  /** Fill between the band lines */
  fill: boolean;
}

export const defaultInputs: DynamicTrendBandsInputs = {
  length: 40,
  src: 'close',
  multi: 2.0,
  bandSize: 2,
  colUp: '#20bfaf',
  colMid: '#aeaeae',
  colDn: '#c12176',
  barsCol: false,
  fill: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 40, min: 11 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'multi', type: 'float', title: 'Distance', defval: 2.0, step: 0.1 },
  { id: 'bandSize', type: 'int', title: 'Size', defval: 2, min: 2, max: 8 },
  { id: 'colUp', type: 'color', title: 'Up Color', defval: '#20bfaf' },
  { id: 'colMid', type: 'color', title: 'Middle Color', defval: '#aeaeae' },
  { id: 'colDn', type: 'color', title: 'Down Color', defval: '#c12176' },
  { id: 'barsCol', type: 'bool', title: 'Momentum Shift', defval: false },
  { id: 'fill', type: 'bool', title: 'Fill Color', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Double HMA', color: '#aeaeae', lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band 1', color: '#20bfaf', lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Lower Band 2', color: '#20bfaf', lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Upper Band 1', color: '#c12176', lineWidth: 1, style: 'linebr' },
  { id: 'plot4', title: 'Upper Band 2', color: '#c12176', lineWidth: 1, style: 'linebr' },
  { id: 'plot5', title: 'Upper Bands Middle line', color: '#c12176', lineWidth: 1, style: 'linebr' },
  { id: 'plot6', title: 'Lower Bands Middle line', color: '#20bfaf', lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Dynamic Trend Bands [ChartPrime]',
  shortTitle: 'Dynamic Trend Bands',
  overlay: true,
};

/** Pine a >= b: false only when b - a > 1e-10 (float comparison tolerance); false when a value is na */
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > 1e-10);
/** Pine a <= b */
const le = (a: number, b: number) => ge(b, a);
/** Pine a > b: true only when a - b > 1e-10 */
const gt = (a: number, b: number) => a - b > 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<DynamicTrendBandsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const bs = cfg.bandSize;
  const at = (a: number[], j: number) => (j >= 0 ? a[j] : NaN);

  // base = ta.hma(ta.hma(close, length - 10), length)
  const close = bars.map((b) => b.close);
  const base = A(ta.hma(S(A(ta.hma(S(close), cfg.length - 10))), cfg.length));
  // dist = ta.atr(100) * multi
  const atr = A(ta.atr(bars, 100));
  const upper = base.map((v, i) => v + atr[i] * cfg.multi);
  const lower = base.map((v, i) => v - atr[i] * cfg.multi);

  // lower_band = lower >= lower[band_size] ? lower[band_size] : na; lower_band1 = ... ? lower : na
  // upper_band = upper <= upper[band_size] ? upper[band_size] : na; upper_band1 = ... ? upper : na
  const lowerBand: number[] = new Array(n);
  const lowerBand1: number[] = new Array(n);
  const upperBand: number[] = new Array(n);
  const upperBand1: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const lb = at(lower, i - bs);
    const lowOk = ge(lower[i], lb);
    lowerBand[i] = lowOk ? lb : NaN;
    lowerBand1[i] = lowOk ? lower[i] : NaN;
    const ub = at(upper, i - bs);
    const upOk = le(upper[i], ub);
    upperBand[i] = upOk ? ub : NaN;
    upperBand1[i] = upOk ? upper[i] : NaN;
  }

  // middle lines: upper_band1[band_size - int(band_size / 2)], lower_band1[...]
  const mid = bs - Math.trunc(bs / 2);

  const plot = (vals: number[], c: string) => bars.map((b, i) => ({ time: b.time, value: vals[i], color: c }));
  const upperMid = bars.map((_b, i) => at(upperBand1, i - mid));
  const lowerMid = bars.map((_b, i) => at(lowerBand1, i - mid));

  // switch: upper_band1 <= upper_band1[2] and high > upper_band => color.orange
  //         lower_band >= lower_band[2] and low < lower_band => color.orange; default #ff980000
  const barColors: BarColorData[] = [];
  for (let i = 0; i < n; i++) {
    let c = '#ff980000';
    if (le(upperBand1[i], at(upperBand1, i - 2)) && gt(bars[i].high, upperBand[i])) c = color.orange;
    else if (ge(lowerBand[i], at(lowerBand, i - 2)) && gt(lowerBand[i], bars[i].low)) c = color.orange;
    // barcolor(color, display = bars_col ? display.all : display.none)
    if (cfg.barsCol) barColors.push({ time: bars[i].time, color: c });
  }

  const colUp1 = String(color.new(cfg.colUp, 50));
  const colDn1 = String(color.new(cfg.colDn, 50));
  const upFill = new Array<string | null>(n).fill(colUp1);
  const dnFill = new Array<string | null>(n).fill(colDn1);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: plot(base, cfg.colMid),
      plot1: plot(lowerBand1, cfg.colUp),
      plot2: plot(lowerBand, cfg.colUp),
      plot3: plot(upperBand, cfg.colDn),
      plot4: plot(upperBand1, cfg.colDn),
      plot5: plot(upperMid, cfg.colDn),
      plot6: plot(lowerMid, cfg.colUp),
    },
    // fill(pl1, pl, lower_band1, lower_band, col_up1, col_up1); fill(ph1, ph, upper_band, upper_band1, col_dn1, col_dn1)
    // display = filll ? display.all : display.none
    fills: cfg.fill
      ? [
        { plot1: 'plot2', plot2: 'plot1', gradient: { topValue: lowerBand1, bottomValue: lowerBand, topColor: upFill, bottomColor: upFill } },
        { plot1: 'plot4', plot2: 'plot3', gradient: { topValue: upperBand, bottomValue: upperBand1, topColor: dnFill, bottomColor: dnFill } },
      ]
      : [],
    markers: [],
    barColors,
  };
}

export const DynamicTrendBands = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
